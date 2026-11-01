#!/usr/bin/env python3
"""Pipeline de imagens do site toso.studio.

Lê as pastas-fonte (Dropbox) e gera a versão web pronta para o repositório:

    <fonte>/_home/*.jpg                 -> slideshow da home
    <fonte>/_ads/<projeto>/*.jpg        -> products & advertising
    <fonte>/_ppl/<projeto>/*.jpg        -> people & fashion
    <fonte>/_pers/<projeto>/*.jpg       -> personal work

Regras
- Nome da pasta = título do projeto (exibido em minúsculas).
- Ordem das imagens = ordem natural do nome do arquivo (como o Finder: 2 < 10).
- Ordem dos projetos = mais recente primeiro. A data de cada projeto é fixada
  na primeira vez que ele é publicado (semente: data do arquivo mais novo da
  pasta) e não muda depois. Pasta nova entra no topo.
- Pastas vazias, ocultas ou que começam com "_" são ignoradas.
- Cada imagem gera 3 tamanhos (lado maior): l=2560, m=1280, s=480. JPEG sRGB
  progressivo, sem metadados.
- Cache incremental: só reprocessa o que mudou (caminho + tamanho + data).

Uso:  python3 publish.py <pasta-fonte> <pasta-saida>
Saída: <saida>/site/assets/img/...  +  <saida>/site/assets/projects.json
"""
import io, json, re, sys, time, unicodedata
from datetime import date
from pathlib import Path

from PIL import Image, ImageCms, ImageOps

SECTIONS = [("ads", "_ads"), ("people", "_ppl"), ("personal", "_pers")]
SIZES = {"l": (2560, 82), "m": (1280, 80), "s": (480, 78)}
EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}
SRGB = ImageCms.createProfile("sRGB")
Image.MAX_IMAGE_PIXELS = None  # arquivos de origem são confiáveis e podem passar de 200 MP


def natural_key(s):
    return [int(t) if t.isdigit() else t.casefold() for t in re.split(r"(\d+)", s)]


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "projeto"


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


def render(src, dest_base):
    """Gera dest_base-{l,m,s}.jpg. Retorna (w, h) da versão l."""
    with Image.open(src) as im:
        # decodificação reduzida (DCT) — muito mais rápida em arquivos de 30+ MP
        im.draft("RGB", (SIZES["l"][0], SIZES["l"][0]))
        im = ImageOps.exif_transpose(im)
        im = to_srgb(im)
        out = None
        for key, (edge, q) in SIZES.items():
            v = im.copy()
            v.thumbnail((edge, edge), Image.LANCZOS)
            v.save(f"{dest_base}-{key}.jpg", "JPEG", quality=q,
                   progressive=True, optimize=True, subsampling="4:2:0")
            if key == "l":
                out = v.size
        return out


def main():
    src_root, out_root = Path(sys.argv[1]), Path(sys.argv[2])
    site = out_root / "site"
    img_root = site / "assets/img"
    cache_file = out_root / "cache.json"
    order_file = out_root / "order.json"
    cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    order = json.loads(order_file.read_text()) if order_file.exists() else {}
    new_cache, written, done = {}, set(), 0
    t0 = time.time()
    budget = float(sys.argv[3]) if len(sys.argv) > 3 else 1e9  # segundos

    def process(files, rel_dir):
        nonlocal done
        out = []
        (img_root / rel_dir).mkdir(parents=True, exist_ok=True)
        for i, f in enumerate(files, 1):
            st = f.stat()
            sig = f"{st.st_size}:{int(st.st_mtime)}"
            base = f"{rel_dir}/{i:02d}"
            key = f"{f}|{base}"
            hit = cache.get(key)
            if hit and hit["sig"] == sig and all(
                    (img_root / f"{base}-{k}.jpg").exists() for k in SIZES):
                wh = hit["wh"]
            else:
                if time.time() - t0 > budget:
                    raise TimeoutError
                wh = render(f, img_root / base)
                done += 1
                print(f"  ok {base}  <- {f.name}", flush=True)
            new_cache[key] = {"sig": sig, "wh": wh}
            for k in SIZES:
                written.add(f"{base}-{k}.jpg")
            out.append({"src": f"/assets/img/{base}", "w": wh[0], "h": wh[1]})
        return out

    manifest = {"sizes": {k: v[0] for k, v in SIZES.items()}, "home": [], "sections": {}}
    try:
        home = src_root / "_home"
        if home.is_dir():
            manifest["home"] = process(images_in(home), "home")

        for route, folder in SECTIONS:
            projects, slugs = [], set()
            base = src_root / folder
            dirs = [d for d in base.iterdir()] if base.is_dir() else []
            for d in sorted(dirs, key=lambda d: natural_key(d.name)):
                if not d.is_dir() or d.name[0] in "._":
                    continue
                files = images_in(d)
                if not files:
                    continue
                slug = slugify(d.name)
                while slug in slugs:
                    slug += "-2"
                slugs.add(slug)
                okey = f"{folder}/{d.name}"
                if okey not in order:
                    newest = max(f.stat().st_mtime for f in files)
                    order[okey] = date.fromtimestamp(newest).isoformat()
                projects.append({
                    "slug": slug,
                    "title": d.name.strip().lower(),
                    "date": order[okey],
                    "images": process(files, f"{route}/{slug}"),
                })
            projects.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
            manifest["sections"][route] = projects
    except TimeoutError:
        cache_file.write_text(json.dumps({**cache, **new_cache}))
        print(f"PARCIAL: {done} imagens processadas; rode de novo para continuar")
        sys.exit(3)

    # Não apaga nada aqui (a pasta do Dropbox não permite). files.txt lista só
    # o que está vivo; o repositório é reconstruído a partir dessa lista.
    (site / "assets/projects.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1))
    (out_root / "files.txt").write_text(
        "assets/projects.json\n" + "".join(f"assets/img/{p}\n" for p in sorted(written)))
    cache_file.write_text(json.dumps(new_cache))
    order_file.write_text(json.dumps(order, ensure_ascii=False, indent=1))
    n = sum(len(p["images"]) for s in manifest["sections"].values() for p in s)
    print(f"OK: {len(manifest['home'])} home, {n} imagens em projetos, "
          f"{done} processadas agora")


if __name__ == "__main__":
    main()
