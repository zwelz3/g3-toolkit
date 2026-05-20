"""Sphinx configuration for g3-toolkit specification documentation."""

project = "g3-toolkit"
copyright = "2026, g3-toolkit contributors"
author = "g3-toolkit contributors"
version = "0.1.0"
release = "0.0.1"

extensions = [
    "myst_parser",
]

myst_enable_extensions = [
    "colon_fence",
    "deflist",
    "fieldlist",
    "tasklist",
]

myst_heading_anchors = 3

templates_path = ["_templates"]
exclude_patterns = []

# -- Theme: Furo (MIT) -------------------------------------------------------
# Furo exposes CSS variables for layout width. The default content-width
# is 46em (~736px), which wastes space on high-DPI monitors. We widen it
# to 72em (~1152px) -- enough to show tables and code comfortably without
# pushing body text past the ~90-character readability threshold.

html_theme = "furo"
html_title = "g3-toolkit"

html_theme_options = {
    "sidebar_hide_name": False,
    "navigation_with_keys": True,
    "light_css_variables": {
        "color-brand-primary": "#2563eb",
        "color-brand-content": "#1d4ed8",
        "content-width": "72em",
        "sidebar-width": "18em",
    },
    "dark_css_variables": {
        "color-brand-primary": "#60a5fa",
        "color-brand-content": "#93bbfd",
        "content-width": "72em",
        "sidebar-width": "18em",
    },
}

html_static_path = ["_static"]
html_css_files = ["custom.css"]

source_suffix = {
    ".rst": "restructuredtext",
    ".md": "markdown",
}
