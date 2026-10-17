"""Turn the NamMa design system's tokens.json into CSS custom properties (light, dark) for the web app."""
import json
import sys

tokens = json.load(open(sys.argv[1]))
colors = tokens["color"]["tokens"]
shadows = tokens["shadow"]["tokens"]


def block(theme: str, indent: str) -> str:
    lines = []
    for t in colors + shadows:
        v = t["value"]
        lines.append(f"{indent}--{t['name']}: {v[theme] if isinstance(v, dict) else v};")
    return "\n".join(lines)


out = [
    "/* Generated from the NamMa design system (tokens.json) by tokens_to_css.py. Don't edit by hand. */",
    ":root {",
    "  color-scheme: light;",
    block("light", "  "),
    "}",
    "@media (prefers-color-scheme: dark) {",
    '  :root:not([data-theme="light"]) {',
    "    color-scheme: dark;",
    block("dark", "    "),
    "  }",
    "}",
    ':root[data-theme="dark"] {',
    "  color-scheme: dark;",
    block("dark", "  "),
    "}",
    "",
    "@theme inline {",
    "  --color-*: initial;",
    "  --color-transparent: transparent;",
    "  --color-current: currentColor;",
]
out += [f"  --color-{t['name']}: var(--{t['name']});" for t in colors]
out.append("}")
print("\n".join(out))
