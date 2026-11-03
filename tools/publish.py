#!/usr/bin/env python3
"""Pipeline de imagens do site toso.studio.

Lê a pasta-fonte (Dropbox) e gera a versão web pronta para o repositório:

    <fonte>/_selected work/<trabalho>/*.jpg  -> selected work (feed + carrosséis)
    <fonte>/_home/<primeira foto>            -> imagem de compartilhamento (og:image)

Regras
- Nome da pasta = título do trabalho, exibido como está (minúsculas, com os
  underlines), ex.: "2026_luiza_barcelos".
- Ordem das imagens = ordem natural do nome do arquivo (como o Finder: 2 < 10).
  A primeira imagem é a capa (feed e home).
- Ordem dos trabalhos:
  0. pastas numeradas ("#1_2026_nome", "#14_2026_nome"): pelo número N, do menor
     para o maior (N=1 no topo). O "#N_" não aparece no título nem na URL;
  1. fixados: pastas que começam com "_" (ex.: "_personal_flowers") ficam no
     topo, na ordem do Finder (só as que não têm número);
  2. depois, por ano (o "2026_" do início do nome), do mais novo para o mais antigo;
  3. dentro do ano, mais recente primeiro. A data de cada trabalho é fixada na
     primeira vez que ele é publicado (semente: data do arquivo mais novo da
     pasta) e não muda depois (order.json; edite as datas para reordenar).
- Pastas vazias ou ocultas (".") são ignoradas.
- Cada imagem gera 3 tamanhos (lado maior): l=2560, m=1280, s=480, em WebP sRGB
  sem metadados, com nome legível: work/<slug>/<slug>-NN-<tamanho>.webp.
  A foto de compartilhamento (og.jpg, 1200 px) continua JPEG, por compatibilidade
  com o preview de WhatsApp e Instagram.
- Cada trabalho também gera og/<slug>.jpg (capa, 1200 px, JPEG) para o preview de links.
- Textos opcionais: <saida>/textos.json, chave = nome da pasta,
  {"titulo": "...", "descricao": "...", "categoria": "...", "fotos": ["alt da foto 1", ...]}.
  Entram no manifest como titulo, desc, cat e alt de cada foto (titulo troca o nome
  exibido nas páginas de SEO; fotos segue a ordem das imagens).
- lastmod de cada trabalho = data do arquivo de origem mais recente (para o sitemap).
- Cache incremental: só reprocessa o que mudou (caminho + tamanho + data).

Uso:   python3 publish.py <pasta-fonte> <pasta-saida> [orçamento-em-segundos]
Saída: <saida>/site/assets/img/...  +  <saida>/site/assets/projects.json
       <saida>/files.txt: o que está vivo (o repositório é reconstruído a partir dela)
"""
import io, json, re, sys, time, unicodedata
from datetime import date
from pathlib import Path

from PIL import Image, ImageCms, ImageOps

WORK = "_selected work"
EXT = "webp"
SIZES = {"l": (2560, 84), "m": (1280, 82), "s": (480, 80)}  # (lado maior, qualidade WebP)
OG = (1200, 80)  # JPEG
EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}
YEAR = re.compile(r"^(\d{4})[ _-]")
SRGB = ImageCms.createProfile("sRGB")
Image.MAX_IMAGE_PIXELS = None  # arquivos de origem são confiáveis e podem passar de 200 MP


def natural_key(s):
    return [int(t) if t.isdigit() else t.casefold() for t in re.split(r"(\d+)", s)]


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "trabalho"


def clean_name(name):
    """Pasta numerada no Finder ("#7_2026_luiza_barcelos"): o "#N_" sai do título
    e da URL, para que o nome continue igual ao de antes. "#99_" marca trabalho
    fixado no topo, como o "_" do início do nome."""
    m = re.match(r"^#(\d+)_", name)
    if not m:
        return name
    rest = name[m.end():]
    return ("_" if m.group(1) == "99" else "") + rest


def order_no(name):
    """Número do "#N_" da pasta: define a ordem dos trabalhos (1 no topo).
    Sem número, o trabalho segue as regras antigas (fixados, ano, data)."""
    m = re.match(r"^#(\d+)_", name)
    return int(m.group(1)) if m else None


def images_in(folder):
    files = [f for f in folder.iterdir()
             if f.is_file() and not f.name.startswith(".") and f.suffix.lower() in EXTS]
    return sorted(files, key=lambda f: (natural_key(f.stem), f.suffix.lower()))


def to_srgb(im):
    icc = im.info.get("icc_profile")
    if icc:
        try:
            src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            im = ImageCms.profileToProfile(im, src, SRGB, outputMode="RGB")
        except Exception:
            pass
    return im.convert("RGB")


def render(src, outputs):
    """outputs = [(destino, lado maior, qualidade)], do maior para o menor.
    Retorna (w, h) da primeira saída."""
    with Image.open(src) as im:
        # decodificação reduzida (DCT): muito mais rápida em arquivos de 30+ MP
        im.draft("RGB", (outputs[0][1], outputs[0][1]))
        im = ImageOps.exif_transpose(im)
        im = to_srgb(im)
        first = None
        for dest, edge, q in outputs:
            v = im.copy()
            v.thumbnail((edge, edge), Image.LANCZOS)
            if str(dest).lower().endswith(".webp"):
                v.save(dest, "WEBP", quality=q, method=6)
            else:
                v.save(dest, "JPEG", quality=q, progressive=True, optimize=True, subsampling="4:2:0")
            first = first or v.size
        return first


def main():
    src_root, out_root = Path(sys.argv[1]), Path(sys.argv[2])
    budget = float(sys.argv[3]) if len(sys.argv) > 3 else 1e9  # segundos
    site = out_root / "site"
    img_root = site / "assets/img"
    cache_file, order_file = out_root / "cache.json", out_root / "order.json"
    cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    order = json.loads(order_file.read_text()) if order_file.exists() else {}
    new_cache, written, done = {}, set(), 0
    t0 = time.time()

    def build(f, rel, outputs):
        """Gera (ou reaproveita do cache) as saídas de f; rel identifica a imagem."""
        nonlocal done
        st = f.stat()
        sig = f"{st.st_size}:{int(st.st_mtime)}"
        key = f"{f}|{rel}"
        hit = cache.get(key)
        if hit and hit["sig"] == sig and all((img_root / p).exists() for p, _, _ in outputs):
            wh = hit["wh"]
        else:
            if time.time() - t0 > budget:
                raise TimeoutError
            (img_root / outputs[0][0]).parent.mkdir(parents=True, exist_ok=True)
            wh = render(f, [(img_root / p, e, q) for p, e, q in outputs])
            done += 1
            print(f"  ok {rel}  <- {f.name}", flush=True)
        new_cache[key] = {"sig": sig, "wh": wh}
        written.update(p for p, _, _ in outputs)
        return wh

    textos_file = out_root / "textos.json"
    textos = json.loads(textos_file.read_text()) if textos_file.exists() else {}
    manifest = {"ext": EXT, "sizes": {k: v[0] for k, v in SIZES.items()}, "work": []}
    try:
        home = src_root / "_home"
        first = images_in(home)[:1] if home.is_dir() else []
        if first:
            build(first[0], "og", [("og.jpg", *OG)])

        base = src_root / WORK
        slugs, numbered, pinned, dated = set(), [], [], []
        dirs = sorted(base.iterdir(), key=lambda d: natural_key(d.name)) if base.is_dir() else []
        for d in dirs:
            if not d.is_dir() or d.name.startswith("."):
                continue
            files = images_in(d)
            if not files:
                continue
            name = clean_name(d.name)   # nome sem o "#N_" da numeração do Finder
            slug = slugify(name)
            while slug in slugs:
                slug += "-2"
            slugs.add(slug)
            okey = f"{WORK}/{name}"
            if okey not in order:
                newest = max(f.stat().st_mtime for f in files)
                order[okey] = date.fromtimestamp(newest).isoformat()
            tx = textos.get(name, {})
            alts = tx.get("fotos") or []   # alt por foto, na ordem das fotos
            if alts and len(alts) != len(files):
                print(f"AVISO: {name} tem {len(files)} fotos e {len(alts)} textos em 'fotos'")
            images = []
            for i, f in enumerate(files, 1):
                rel = f"work/{slug}/{slug}-{i:02d}"
                w, h = build(f, rel, [(f"{rel}-{k}.{EXT}", e, q) for k, (e, q) in SIZES.items()])
                im = {"src": f"/assets/img/{rel}", "w": w, "h": h}
                if i <= len(alts) and alts[i - 1]:
                    im["alt"] = alts[i - 1]
                images.append(im)
            # imagem de compartilhamento do trabalho (capa, 1200 px, JPEG)
            build(files[0], f"og/{slug}", [(f"og/{slug}.jpg", *OG)])
            work = {
                "slug": slug,
                "title": name.strip().lower(),
                "titulo": tx.get("titulo", ""),
                "og": f"/assets/img/og/{slug}.jpg",
                "date": order[okey],
                "lastmod": date.fromtimestamp(max(f.stat().st_mtime for f in files)).isoformat(),
                "desc": tx.get("descricao", ""),
                "cat": tx.get("categoria", ""),
                "images": images,
            }
            num = order_no(d.name)
            if num is not None:
                numbered.append((num, work))
            elif name.startswith("_"):
                pinned.append(work)
            else:
                m = YEAR.match(name)
                dated.append((int(m.group(1)) if m else int(order[okey][:4]), work))
        numbered.sort(key=lambda t: (t[0], t[1]["slug"]))
        dated.sort(key=lambda t: (t[0], t[1]["date"], t[1]["slug"]), reverse=True)
        manifest["work"] = [w for _, w in numbered] + pinned + [w for _, w in dated]
    except TimeoutError:
        cache_file.write_text(json.dumps({**cache, **new_cache}))
        print(f"PARCIAL: {done} imagens processadas; rode de novo para continuar")
        sys.exit(3)

    # Não apaga nada aqui (a pasta do Dropbox não permite). files.txt lista só
    # o que está vivo; o repositório é reconstruído a partir dessa lista.
    (site / "assets").mkdir(parents=True, exist_ok=True)
    (site / "assets/projects.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1))
    (out_root / "files.txt").write_text(
        "assets/projects.json\n" + "".join(f"assets/img/{p}\n" for p in sorted(written)))
    cache_file.write_text(json.dumps(new_cache))
    order_file.write_text(json.dumps(order, ensure_ascii=False, indent=1))
    n = sum(len(p["images"]) for p in manifest["work"])
    print(f"OK: {len(manifest['work'])} trabalhos, {n} imagens, "
          f"{'og, ' if first else ''}{done} processadas agora")


if __name__ == "__main__":
    main()
