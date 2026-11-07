#!/usr/bin/env python3
"""Gera as páginas estáticas do site (SEO) a partir de assets/projects.json.

O site continua sendo um HTML + CSS + JS puros servidos pelo GitHub Pages. O que
este script faz é dar uma URL real, com conteúdo no HTML, a cada página:

    /                      home
    /trabalhos/            selected work (grade de capas)
    /trabalhos/<slug>/     um trabalho
    /contato/              contato
    /sobre/                sobre (a bio fica no index.html, em #about)
    /404.html              página não encontrada (noindex)
    /sitemap.xml           páginas + <image:image> de cada foto
    /robots.txt
    /.nojekyll

O index.html é o molde. As regiões entre <!--seo:head--> ... <!--/seo:head--> e
<!--seo:body--> ... <!--/seo:body--> são regeneradas a cada execução. O visual vem
do mesmo CSS e do mesmo JS; o conteúdo para buscadores fica num bloco que não
aparece na tela (.sr-only) e numa galeria fora da área visível (.seo-gallery).

Uso:   python3 tools/build_pages.py          gera/atualiza os arquivos
       python3 tools/build_pages.py --check  confere o HTML bruto, sem JavaScript

Rode de novo sempre que o publish.py gerar um assets/projects.json novo.
"""
import html, json, re, shutil, sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://www.toso.studio"
NAME = "Renato Toso"
BRAND = "____TOSO"
ROLE = "fotógrafo em São Paulo"
INSTAGRAM = "https://instagram.com/___toso"
EMAIL = "toso.renato@gmail.com"
PHONE = "+55 11 97388-9977"
WHATSAPP = "https://wa.me/5511973889977"
HOME_DESC = "Renato Toso — fotógrafo em São Paulo. Still life, produto, publicidade, moda e retrato."
CONTACT_NOTE = ("Disponível para projetos de fotografia em moda, produto, still life e publicidade. "
                "Baseado no Brasil. Trabalhos nacionais e internacionais.")
OG_HOME = "/assets/img/og.jpg"
SERVICES = ["Fotografia de still life", "Fotografia de produto", "Fotografia publicitária",
            "Fotografia de moda", "Retrato"]
CITY = {"@type": "PostalAddress", "addressLocality": "São Paulo",
        "addressRegion": "SP", "addressCountry": "BR"}


# ─── utilidades ───
def esc(s):
    return html.escape(str(s), quote=True)


def jld(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def nome(w):
    """Nome para texto (título, h1, alt). Troca com "titulo" em textos.json."""
    if w.get("titulo"):
        return w["titulo"]
    t = w["title"].lstrip("_")
    m = re.match(r"^(\d{4})[ _-]+(.*)$", t)
    year, rest = (m.group(1), m.group(2)) if m else ("", t)
    rest = re.sub(r"\s+", " ", rest.replace("_", " ").replace("+", " + ")).strip()
    return f"{rest} ({year})" if year else rest


def alt_of(w, k):
    im = w["images"][k]
    return im.get("alt") or f"{nome(w)}, foto {k + 1} de {len(w['images'])}"


def wpath(w):
    return f"/trabalhos/{w['slug']}/"


def small(im, sizes, k="s"):
    long = max(im["w"], im["h"])
    f = min(1, sizes[k] / long)
    return round(im["w"] * f), round(im["h"] * f)


def img_tag(im, ext, sizes, alt):
    w, h = small(im, sizes)
    return (f'<img src="{im["src"]}-s.{ext}" width="{w}" height="{h}" alt="{esc(alt)}" '
            f'loading="lazy" decoding="async">')


def link(href, text):
    # tabindex=-1: os links existem para buscadores e leitores de tela, sem poluir o Tab
    return f'<a href="{href}" tabindex="-1">{esc(text)}</a>'


# ─── páginas ───
def build_pages(m):
    ext, sizes, works = m.get("ext", "jpg"), m["sizes"], m["work"]
    last = max((w.get("lastmod") or w["date"] for w in works), default="")
    person = {"@type": "Person", "@id": BASE + "/#person", "name": NAME, "jobTitle": "Fotógrafo",
              "url": BASE + "/", "sameAs": [INSTAGRAM], "address": CITY}
    pages = []

    # home
    home_nav = "".join(f"<li>{link(wpath(w), nome(w))}</li>" for w in works)
    pages.append({
        "path": "/", "kind": "home", "file": ROOT / "index.html",
        "title": f"{BRAND} — {NAME}, {ROLE}", "desc": HOME_DESC, "og": OG_HOME,
        "og_alt": f"Fotografia de {NAME}",
        "ld": {"@context": "https://schema.org", "@graph": [
            {"@type": "WebSite", "@id": BASE + "/#website", "url": BASE + "/",
             "name": f"{BRAND} — {NAME}", "inLanguage": "pt-BR", "publisher": {"@id": BASE + "/#person"}},
            person]},
        "text": (f"<h1>{NAME}, {ROLE}</h1>\n<p>{esc(HOME_DESC)}</p>\n"
                 f'<nav aria-label="Trabalhos"><ul>{home_nav}</ul>\n'
                 f'<p>{link("/trabalhos/", "Trabalhos selecionados")} {link("/contato/", "Contato")} {link("/sobre/", "Sobre")}</p></nav>'),
        "gallery": "".join(
            f'<a href="{wpath(w)}" tabindex="-1">{img_tag(w["images"][0], ext, sizes, alt_of(w, 0))}</a>'
            for w in works),
    })

    # trabalhos (grade)
    desc = f"Trabalhos selecionados de {NAME}, {ROLE}: still life, produto, publicidade, moda e retrato."
    pages.append({
        "path": "/trabalhos/", "kind": "work", "file": ROOT / "trabalhos/index.html",
        "title": f"Trabalhos selecionados — {NAME}, {ROLE}", "desc": desc, "og": OG_HOME,
        "og_alt": f"Trabalhos selecionados de {NAME}",
        "ld": {"@context": "https://schema.org", "@graph": [
            {"@type": "CollectionPage", "@id": BASE + "/trabalhos/#page", "url": BASE + "/trabalhos/",
             "name": "Trabalhos selecionados", "inLanguage": "pt-BR", "author": person,
             "mainEntity": {"@type": "ItemList", "itemListElement": [
                 {"@type": "ListItem", "position": i, "url": BASE + wpath(w), "name": nome(w)}
                 for i, w in enumerate(works, 1)]}},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Início", "item": BASE + "/"},
                {"@type": "ListItem", "position": 2, "name": "Trabalhos selecionados"}]}]},
        "text": (f"<h1>Trabalhos selecionados</h1>\n<p>{esc(desc)}</p>\n"
                 f'<nav aria-label="Trabalhos"><ul>{home_nav}</ul>\n'
                 f'<p>{link("/", "Início")} {link("/contato/", "Contato")} {link("/sobre/", "Sobre")}</p></nav>'),
        "gallery": "".join(
            f'<a href="{wpath(w)}" tabindex="-1">{img_tag(w["images"][0], ext, sizes, alt_of(w, 0))}</a>'
            for w in works),
    })

    # um trabalho
    for i, w in enumerate(works):
        n, nm = len(w["images"]), nome(w)
        d = w.get("desc") or f"{nm}: fotografias de {NAME}, {ROLE}. {n} {'foto' if n == 1 else 'fotos'}."
        og = w.get("og") or OG_HOME
        crumbs = {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Início", "item": BASE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Trabalhos selecionados", "item": BASE + "/trabalhos/"},
            {"@type": "ListItem", "position": 3, "name": nm}]}
        gallery = {"@type": "ImageGallery", "@id": BASE + wpath(w) + "#gallery", "url": BASE + wpath(w),
                   "name": nm, "description": d, "inLanguage": "pt-BR",
                   "datePublished": w["date"], "dateModified": w.get("lastmod") or w["date"],
                   "author": {"@type": "Person", "name": NAME, "url": BASE + "/"},
                   "image": [{"@type": "ImageObject", "contentUrl": f"{BASE}{im['src']}-l.{ext}",
                              "name": nm, "caption": alt_of(w, k), "width": im["w"], "height": im["h"],
                              "creator": {"@type": "Person", "name": NAME}}
                             for k, im in enumerate(w["images"])]}
        near = [x for x in (works[i - 1] if i else None, works[i + 1] if i + 1 < len(works) else None) if x]
        nav = "".join(f"<li>{link(wpath(x), nome(x))}</li>" for x in near)
        pages.append({
            "path": wpath(w), "kind": "work", "file": ROOT / f"trabalhos/{w['slug']}/index.html",
            "title": f"{nm} — {NAME}, {ROLE}", "desc": d, "og": og, "og_alt": alt_of(w, 0),
            "ld": {"@context": "https://schema.org", "@graph": [gallery, crumbs]},
            "text": (f"<h1>{esc(nm)}</h1>\n<p>{esc(d)}</p>\n"
                     f'<nav aria-label="Navegação"><ul><li>{link("/", "Início")}</li>'
                     f'<li>{link("/trabalhos/", "Trabalhos selecionados")}</li><li>{link("/sobre/", "Sobre")}</li>{nav}</ul></nav>'),
            "gallery": "".join(
                f'<figure>{img_tag(im, ext, sizes, alt_of(w, k))}<figcaption>{esc(alt_of(w, k))}</figcaption></figure>'
                for k, im in enumerate(w["images"])),
            "lastmod": w.get("lastmod") or w["date"], "work": w,
        })

    # contato (o H1 é o título visível "Contato", trocado de h2 para h1 no molde)
    cdesc = f"Contato de {NAME}, {ROLE}. {CONTACT_NOTE}"
    pages.append({
        "path": "/contato/", "kind": "contact", "file": ROOT / "contato/index.html",
        "title": f"Contato — {NAME}, {ROLE}", "desc": cdesc, "og": OG_HOME,
        "og_alt": f"Contato de {NAME}", "h1_in_shell": "Contato",
        "ld": {"@context": "https://schema.org", "@graph": [
            {"@type": "ProfessionalService", "@id": BASE + "/contato/#service", "name": f"{NAME} — fotografia",
             "url": BASE + "/contato/", "image": BASE + OG_HOME, "email": EMAIL, "telephone": PHONE,
             "address": CITY, "areaServed": [{"@type": "City", "name": "São Paulo"},
                                             {"@type": "Country", "name": "Brasil"}],
             "serviceType": SERVICES, "sameAs": [INSTAGRAM], "description": CONTACT_NOTE},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Início", "item": BASE + "/"},
                {"@type": "ListItem", "position": 2, "name": "Contato"}]}]},
        "text": (f"<p>{NAME} é {ROLE}. {esc(CONTACT_NOTE)}</p>\n"
                 f'<nav aria-label="Navegação"><ul><li>{link("/", "Início")}</li>'
                 f'<li>{link("/trabalhos/", "Trabalhos selecionados")}</li><li>{link("/sobre/", "Sobre")}</li></ul></nav>'),
        "gallery": "",
    })

    # sobre (a bio é o texto visível da seção #about do index.html)
    adesc = f"{NAME} nasceu em São Paulo e trabalha com fotografia desde 2011. Moda, produto, retrato e projetos autorais."
    pages.append({
        "path": "/sobre/", "kind": "about", "file": ROOT / "sobre/index.html",
        "title": f"Sobre — {NAME}, {ROLE}", "desc": adesc, "og": OG_HOME,
        "og_alt": f"Sobre {NAME}", "h1_in_shell": "Sobre",
        "ld": {"@context": "https://schema.org", "@graph": [
            {"@type": "AboutPage", "@id": BASE + "/sobre/#page", "url": BASE + "/sobre/", "name": f"Sobre {NAME}",
             "inLanguage": "pt-BR", "mainEntity": {"@id": BASE + "/#person"}},
            person,
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Início", "item": BASE + "/"},
                {"@type": "ListItem", "position": 2, "name": "Sobre"}]}]},
        "text": (f'<nav aria-label="Navegação"><ul><li>{link("/", "Início")}</li>'
                 f'<li>{link("/trabalhos/", "Trabalhos selecionados")}</li><li>{link("/contato/", "Contato")}</li></ul></nav>'),
        "gallery": "",
    })
    return pages


def head_html(p, titles):
    url = BASE + p["path"]
    t, d, og = esc(p["title"]), esc(p["desc"]), BASE + p["og"]
    return "\n".join("  " + x for x in [
        f"<title>{t}</title>",
        f'<meta name="description" content="{d}">',
        f'<link rel="canonical" href="{url}">',
        f'<meta property="og:site_name" content="{BRAND}">',
        '<meta property="og:locale" content="pt_BR">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:title" content="{t}">',
        f'<meta property="og:description" content="{d}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{og}">',
        f'<meta property="og:image:alt" content="{esc(p["og_alt"])}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<script type="application/ld+json">{jld(p["ld"])}</script>',
        f'<script type="application/json" id="seo-titles">{jld(titles)}</script>',
    ])


def body_html(p):
    out = f'<div class="sr-only" id="seo">\n{p["text"]}\n</div>'
    if p["gallery"]:
        out += f'\n<div class="seo-gallery">{p["gallery"]}</div>'
    return out


def region(text, name, content):
    pat = re.compile(rf"(<!--seo:{name}-->)(.*?)(<!--/seo:{name}-->)", re.S)
    if not pat.search(text):
        raise SystemExit(f"molde sem a região seo:{name}")
    return pat.sub(lambda mo: f"{mo.group(1)}\n{content}\n  {mo.group(3)}", text, count=1)


def sitemap(pages, ext):
    urls, last = [], max((p.get("lastmod", "") for p in pages), default="")
    for p in pages:
        lm = p.get("lastmod") or (last if p["path"] in ("/", "/trabalhos/") else "")
        x = f"  <url>\n    <loc>{BASE}{p['path']}</loc>\n"
        if lm:
            x += f"    <lastmod>{lm}</lastmod>\n"
        w = p.get("work")
        if w:
            for k, im in enumerate(w["images"]):
                x += (f"    <image:image>\n      <image:loc>{BASE}{im['src']}-l.{ext}</image:loc>\n"
                      f"      <image:caption>{esc(alt_of(w, k))}</image:caption>\n    </image:image>\n")
        urls.append(x + "  </url>\n")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + "".join(urls) + "</urlset>\n")


NOT_FOUND = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Página não encontrada — {NAME}</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{min-height:100dvh;display:grid;place-items:center;background:#d2d2d2;color:#111;
      font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.7;text-align:center;padding:28px}}
    h1{{font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.14em;opacity:.45;margin-bottom:24px}}
    a{{color:inherit;text-decoration:none;border-bottom:1px solid rgba(0,0,0,.3)}}
    a:hover{{border-color:rgba(0,0,0,.6)}}
  </style>
</head>
<body>
  <main>
    <h1>Página não encontrada</h1>
    <p><a href="/">Voltar para {BRAND}</a></p>
  </main>
</body>
</html>
"""


def generate():
    m = json.loads((ROOT / "assets/projects.json").read_text())
    pages = build_pages(m)
    titles = {p["path"]: p["title"] for p in pages}
    tpl = (ROOT / "index.html").read_text()
    for p in pages:
        t = region(tpl, "head", head_html(p, titles))
        t = region(t, "body", body_html(p))
        if p.get("h1_in_shell"):
            h = p["h1_in_shell"]
            t = t.replace(f'<h2 class="contact-heading">{h}</h2>', f'<h1 class="contact-heading">{h}</h1>')
        p["html"] = t
    slugs = {p["work"]["slug"] for p in pages if p.get("work")}
    tdir = ROOT / "trabalhos"
    if tdir.is_dir():
        for d in tdir.iterdir():
            if d.is_dir() and d.name not in slugs:
                shutil.rmtree(d)
    for p in pages:
        p["file"].parent.mkdir(parents=True, exist_ok=True)
        p["file"].write_text(p["html"])
    (ROOT / "sitemap.xml").write_text(sitemap(pages, m.get("ext", "jpg")))
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {BASE}/sitemap.xml\n")
    (ROOT / "404.html").write_text(NOT_FOUND)
    (ROOT / ".nojekyll").write_text("")
    n = sum(len(w["images"]) for w in m["work"])
    print(f"OK: {len(pages)} páginas, {len(slugs)} trabalhos, {n} fotos no sitemap")


# ─── conferência do HTML bruto (sem JavaScript) ───
class Raw(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title, self.h1, self.imgs, self.links, self.ld = "", 0, [], [], []
        self.meta, self.canon, self.lang, self._in, self._buf = {}, "", "", "", ""

    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == "html":
            self.lang = a.get("lang", "")
        elif tag == "h1":
            self.h1 += 1
        elif tag == "img":
            self.imgs.append(a)
        elif tag == "a" and a.get("href"):
            self.links.append(a["href"])
        elif tag == "meta":
            k = a.get("name") or a.get("property")
            if k:
                self.meta[k] = a.get("content", "")
        elif tag == "link" and a.get("rel") == "canonical":
            self.canon = a.get("href", "")
        elif tag == "script" and a.get("type") == "application/ld+json":
            self._in, self._buf = "ld", ""
        elif tag == "title":
            self._in, self._buf = "title", ""

    def handle_data(self, d):
        if self._in:
            self._buf += d

    def handle_endtag(self, tag):
        if tag == "script" and self._in == "ld":
            self.ld.append(self._buf)
        elif tag == "title" and self._in == "title":
            self.title = self._buf.strip()
        if tag in ("script", "title"):
            self._in = ""


def disk(path):
    p = path.split("#")[0].split("?")[0]
    f = ROOT / p.lstrip("/")
    return f / "index.html" if p.endswith("/") else f


def check():
    m = json.loads((ROOT / "assets/projects.json").read_text())
    ext, errs = m.get("ext", "jpg"), []
    pages = build_pages(m)
    titles, descs = {}, {}
    for p in pages:
        f = p["file"]
        if not f.exists():
            errs.append(f"{p['path']}: arquivo não existe")
            continue
        r = Raw()
        r.feed(f.read_text())
        url = BASE + p["path"]
        if r.lang != "pt-BR": errs.append(f"{p['path']}: lang={r.lang!r}")
        if r.h1 != 1: errs.append(f"{p['path']}: {r.h1} <h1>")
        if not r.title: errs.append(f"{p['path']}: sem <title>")
        if r.canon != url: errs.append(f"{p['path']}: canonical {r.canon!r} != {url!r}")
        if r.meta.get("og:url") != url: errs.append(f"{p['path']}: og:url diferente")
        if not r.meta.get("description"): errs.append(f"{p['path']}: sem description")
        for k in ("og:title", "og:description", "og:image", "twitter:card"):
            if not r.meta.get(k): errs.append(f"{p['path']}: sem {k}")
        if r.title in titles: errs.append(f"{p['path']}: title repetido ({titles[r.title]})")
        titles[r.title] = p["path"]
        if p.get("work"):
            d = r.meta.get("description", "")
            if d in descs: errs.append(f"{p['path']}: description repetida ({descs[d]})")
            descs[d] = p["path"]
            if len(r.imgs) != len(p["work"]["images"]):
                errs.append(f"{p['path']}: {len(r.imgs)} <img> no HTML, esperado {len(p['work']['images'])}")
        if not r.ld: errs.append(f"{p['path']}: sem JSON-LD")
        for blob in r.ld:
            try: json.loads(blob)
            except ValueError as e: errs.append(f"{p['path']}: JSON-LD inválido ({e})")
        for im in r.imgs:
            if not (im.get("alt") or "").strip(): errs.append(f"{p['path']}: <img> sem alt ({im.get('src')})")
            if not im.get("width") or not im.get("height"): errs.append(f"{p['path']}: <img> sem width/height")
            if im.get("loading") != "lazy": errs.append(f"{p['path']}: <img> sem loading=lazy")
            if not disk(im["src"]).exists(): errs.append(f"{p['path']}: imagem inexistente {im['src']}")
        for h in r.links:
            if h.startswith("/") and not h.startswith("//") and not disk(h).exists():
                errs.append(f"{p['path']}: link quebrado {h}")
        og = r.meta.get("og:image", "")
        if not disk(og.replace(BASE, "")).exists(): errs.append(f"{p['path']}: og:image inexistente")
    # sitemap e robots
    try:
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "i": "http://www.google.com/schemas/sitemap-image/1.1"}
        root = ET.parse(ROOT / "sitemap.xml").getroot()
        locs = [u.find("s:loc", ns).text for u in root.findall("s:url", ns)]
        if sorted(locs) != sorted(BASE + p["path"] for p in pages): errs.append("sitemap: URLs diferentes das páginas")
        imgs = [e.text for e in root.iter("{%s}loc" % ns["i"])]
        if len(imgs) != sum(len(w["images"]) for w in m["work"]): errs.append(f"sitemap: {len(imgs)} imagens")
        for u in imgs:
            if not disk(u.replace(BASE, "")).exists(): errs.append(f"sitemap: imagem inexistente {u}")
    except Exception as e:
        errs.append(f"sitemap: {e}")
    if f"Sitemap: {BASE}/sitemap.xml" not in (ROOT / "robots.txt").read_text(): errs.append("robots.txt sem Sitemap")
    for f in ("404.html", ".nojekyll"):
        if not (ROOT / f).exists(): errs.append(f"{f} não existe")
    for e in errs:
        print("ERRO", e)
    print(f"{'FALHOU' if errs else 'OK'}: {len(pages)} páginas conferidas, {len(errs)} erro(s)")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    check() if "--check" in sys.argv else generate()
