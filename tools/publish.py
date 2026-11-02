#!/usr/bin/env python3
"""Pipeline de imagens do site toso.studio.

Lê a pasta-fonte (Dropbox) e gera a versão web pronta para o repositório:

    <fonte>/_selected work/<trabalho>/*.jpg  -> selected work (feed + carrosséis)
    <fonte>/_home/<primeira foto>            -> imagem de compartilhamento (og:image)

Regras
- Nome da pasta = título do trabalho (exibido em minúsculas).
- Ordem das imagens = ordem natural do nome do arquivo (como o Finder: 2 < 10).
  A primeira imagem é a capa (feed e home).
- Ordem dos trabalhos = mais recente primeiro. A data de cada trabalho é fixada
  na primeira vez que ele é publicado (semente: data do arquivo mais novo da
  pasta) e não muda depois (order.json). Pasta nova entra no topo.
- Pastas vazias, ocultas ou que começam com "_" são ignoradas.
- Cada imagem gera 3 tamanhos (lado maior): l=2560, m=1280, s=480. JPEG sRGB
  progressivo, sem metadados. A foto de compartilhamento sai com 1200 px.
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
SIZES = {"l": (2560, 82), "m": (1280, 80), "s": (480, 78)}
OG = (1200, 80)
EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}
SRGB = ImageCms.createProfile("sRGB")
Image.MAX_IMAGE_PIXELS = None  # arquivos de origem são confiáveis e podem passar de 200 MP


def natural_key(s):
    return [int(t) if t.isdigit() else t.casefold() for t in re.split(r"(\d+)", s)]


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "trabalho"


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

    manifest = {"sizes": {k: v[0] for k, v in SIZES.items()}, "work": []}
    try:
        home = src_root / "_home"
        first = images_in(home)[:1] if home.is_dir() else []
        if first:
            build(first[0], "og", [("og.jpg", *OG)])

        base = src_root / WORK
        slugs = set()
        dirs = sorted(base.iterdir(), key=lambda d: natural_key(d.name)) if base.is_dir() else []
        for d in dirs:
            if not d.is_dir() or d.name[0] in "._":
                continue
            files = images_in(d)
            if not files:
                continue
            slug = slugify(d.name)
            while slug in slugs:
                slug += "-2"
            slugs.add(slug)
            okey = f"{WORK}/{d.name}"
            if okey not in order:
                newest = max(f.stat().st_mtime for f in files)
                order[okey] = date.fromtimestamp(newest).isoformat()
            images = []
            for i, f in enumerate(files, 1):
                rel = f"work/{slug}/{i:02d}"
                w, h = build(f, rel, [(f"{rel}-{k}.jpg", e, q) for k, (e, q) in SIZES.items()])
                images.append({"src": f"/assets/img/{rel}", "w": w, "h": h})
            manifest["work"].append({
                "slug": slug,
                "title": d.name.strip().lower(),
                "date": order[okey],
                "images": images,
            })
        manifest["work"].sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
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
