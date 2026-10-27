from scripts.build_pages import build_pages


def test_static_site_build_uses_relative_assets_and_copies_static_files(tmp_path):
    output = tmp_path / "site"
    build_pages(output)

    html = (output / "index.html").read_text()
    assert 'href="static/styles.css"' in html
    assert 'src="static/app.js"' in html
    assert 'href="./"' in html
    assert "{{" not in html

    for asset in ("app.js", "interaction.js", "renderer.js", "styles.css"):
        assert (output / "static" / asset).is_file()
    for font in ("Silkscreen-Regular.ttf", "Silkscreen-Bold.ttf"):
        assert (output / "static" / "fonts" / font).is_file()
    assert not list(output.rglob(".DS_Store"))
