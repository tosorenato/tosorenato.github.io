#!/usr/bin/env python3
"""Gera assets/projects.json a partir das pastas de projeto.

Uso (na raiz do repo):  python3 tools/build_manifest.py
Valida a regra de nomes {secao}_{projeto}_{n}.jpeg (n começa em 1, sem buracos)
e sai com erro se algo estiver fora do padrão.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECTIONS = {"ads": "ads", "ppl": "ppl", "pers": "pers"}
NAME = re.compile(r"^(ads|ppl|pers)_([a-j])_(\d+)\.jpeg$")

manifest, errors = {}, []
for sec in SECTIONS:
    for folder in sorted((ROOT / "assets/img" / sec).glob(f"{sec}_?")):
        if not folder.is_dir():
            continue
        prefix = folder.name
        nums = []
        for f in folder.iterdir():
            if f.name.startswith(".") :
                continue
            m = NAME.match(f.name)
            if not m or f"{m[1]}_{m[2]}" != prefix:
                errors.append(f"nome fora do padrão: {f.relative_to(ROOT)}")
                continue
            nums.append(int(m[3]))
        nums.sort()
        if nums and nums != list(range(1, len(nums) + 1)):
            errors.append(f"numeração com buraco em {prefix}: {nums}")
        manifest[prefix] = len(nums)

if errors:
    print("\n".join(errors))
    sys.exit(1)

out = ROOT / "assets/projects.json"
out.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
print(f"ok: {out.relative_to(ROOT)} -> " + ", ".join(f"{k}:{v}" for k, v in manifest.items() if v))
