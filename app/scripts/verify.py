#!/usr/bin/env python3
"""Walk VisitSheet acceptance at 320, 1024, and 1440, then scan large-text fonts.

BASE and OUT:
  VISITSHEET_BASE default http://127.0.0.1:3788
  VISITSHEET_EVIDENCE default /workspace/visit-sheet-rc3/review/rc4/evidence
"""
import json
import os
import urllib.request
import urllib.error
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

BASE = os.environ.get("VISITSHEET_BASE", "http://127.0.0.1:3788").rstrip("/")
OUT = Path(os.environ.get("VISITSHEET_EVIDENCE", "/workspace/visit-sheet-rc3/review/rc4/evidence"))
OUT.mkdir(parents=True, exist_ok=True)
LEAK = ("ReferenceError", "TypeError", "/workspace/", "/home/", "node_modules", "<pre", "at Object.", ".ejs:")
DISC = "VisitSheet organizes your own notes. It is not medical advice. All demo data is fictional."
RESULTS = []


def add(name, ok, detail="", **extra):
    item = {"name": name, "ok": bool(ok), "detail": str(detail)[:500]}
    item.update(extra)
    RESULTS.append(item)
    print(("OK  " if ok else "FAIL") + f" {name} {detail}", flush=True)


def overflow(page):
    return page.evaluate(
        """() => {
          const el = document.documentElement;
          return { n: el.scrollWidth - el.clientWidth, sw: el.scrollWidth, cw: el.clientWidth };
        }"""
    )


def fonts(page):
    return page.evaluate(
        """() => {
          const h1 = document.querySelector('h1');
          const disc = document.querySelector('.brief-disclaimer, footer p, .site-footer');
          const cs = (node) => node ? getComputedStyle(node).fontSize : '';
          return { h1: cs(h1), disc: cs(disc), body: document.body.className,
                   family: getComputedStyle(document.body).fontFamily };
        }"""
    )


def no_leak(html):
    low = html or ""
    return not any(token in low for token in LEAK)


def http(method, path, data=None, headers=None):
    req = urllib.request.Request(BASE + path, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            body = res.read().decode("utf-8", "replace")
            return res.status, body
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", "replace")
        return err.code, body


def login(page):
    page.goto(BASE + "/login?fill=1", wait_until="networkidle")
    page.locator("form[action='/login'] button[type=submit]").click()
    page.wait_for_load_state("networkidle")


def font_probe(page):
    """Visible text floor for vs_display=large. Skip .visually-hidden and .sr-only."""
    return page.evaluate(
        """() => {
          function skipped(el) {
            if (el.closest('.visually-hidden, .sr-only')) return true;
            for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
              const style = getComputedStyle(node);
              if (style.display === 'none' || style.visibility === 'hidden') return true;
            }
            return false;
          }
          function selector(el) {
            const tag = el.tagName.toLowerCase();
            const id = el.id ? '#' + el.id : '';
            const raw = typeof el.className === 'string' ? el.className : '';
            const cls = raw.trim().split(/\\s+/).filter(Boolean).slice(0, 3);
            return tag + id + (cls.length ? '.' + cls.join('.') : '');
          }
          function directText(el) {
            for (const node of el.childNodes) {
              if (node.nodeType === 3 && node.textContent.trim()) return true;
            }
            return false;
          }
          const controls = new Set(['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT']);
          let minPx = null;
          let minSelector = '';
          const under = [];
          const root = document.body;
          for (const el of root.querySelectorAll('*')) {
            if (skipped(el)) continue;
            const control = controls.has(el.tagName);
            if (!control && !directText(el)) continue;
            const size = parseFloat(getComputedStyle(el).fontSize);
            if (!Number.isFinite(size)) continue;
            if (minPx === null || size < minPx) {
              minPx = size;
              minSelector = selector(el);
            }
            if (size < 22) under.push(selector(el) + '=' + size);
          }
          const headings = [];
          let headingsOk = true;
          for (const el of root.querySelectorAll('h2, h3')) {
            if (skipped(el)) continue;
            const size = parseFloat(getComputedStyle(el).fontSize);
            const links = [];
            for (const link of el.querySelectorAll('a')) {
              if (skipped(link)) continue;
              const linkSize = parseFloat(getComputedStyle(link).fontSize);
              links.push({ selector: selector(link), px: linkSize });
              if (!(linkSize > 22)) headingsOk = false;
            }
            headings.push({ selector: selector(el), px: size, links: links });
            if (!(size > 22)) headingsOk = false;
          }
          const doc = document.documentElement;
          return {
            minPx: minPx,
            minSelector: minSelector,
            under: under.slice(0, 12),
            headings: headings,
            headingsOk: headingsOk,
            overflow: doc.scrollWidth - doc.clientWidth,
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            body: document.body.className || ''
          };
        }"""
    )


def font_scan(browser):
    """Cookie vs_display=large, then 13 pages at 320, 390, and 1440."""
    for width in (320, 390, 1440):
        context = browser.new_context(viewport={"width": width, "height": 900}, device_scale_factor=1)
        # url sets host and Path=/. Playwright rejects url together with path.
        context.add_cookies([{
            "name": "vs_display",
            "value": "large",
            "url": BASE + "/",
        }])
        page = context.new_page()
        try:
            record_font(page, width, "/login", 200)
            login(page)
            href = page.get_attribute(".next-banner h2 a", "href")
            if not href or not href.startswith("/visits/"):
                add(f"font {width} next visit", False, f"missing next visit link {href}")
                continue
            paths = [
                "/about",
                "/display",
                "/dashboard",
                href,
                href + "/brief",
                href + "/brief?text=large",
                "/medicines",
                "/about-me",
                "/settings",
                href + "/delete",
                "/demo/reset",
                "/no-such-page",
            ]
            for path in paths:
                expect = 404 if path == "/no-such-page" else 200
                record_font(page, width, path, expect)
        finally:
            context.close()


def record_font(page, width, path, expect_status):
    response = page.goto(BASE + path, wait_until="networkidle")
    page.evaluate("() => document.fonts.ready")
    probe = font_probe(page)
    landed = urlparse(page.url)
    expected_path = path.split("?", 1)[0]
    query_ok = True
    if "text=large" in path:
        query_ok = "text=large" in (landed.query or "")
    status = response.status if response else 0
    min_px = probe["minPx"]
    overflow_n = probe["overflow"]
    large_on = "large-text" in probe["body"]
    print_on = "large-print" in probe["body"]
    needs_print = "text=large" in path
    ok = (
        status == expect_status
        and landed.path == expected_path
        and query_ok
        and large_on
        and (print_on if needs_print else True)
        and min_px is not None
        and min_px >= 22
        and probe["headingsOk"]
        and overflow_n <= 1
    )
    detail = (
        f"status={status} min={min_px} sel={probe['minSelector']} "
        f"overflow={overflow_n} body={probe['body']}"
    )
    if probe["under"]:
        detail += " under=" + ",".join(probe["under"])
    add(
        f"font {width} {path}",
        ok,
        detail,
        viewport=width,
        path=path,
        min_px=min_px,
        min_selector=probe["minSelector"],
        overflow=overflow_n,
        scroll_width=probe["scrollWidth"],
        client_width=probe["clientWidth"],
        h2_h3=probe["headings"],
        body_class=probe["body"],
        status=status,
    )


def main():
    status, health = http("GET", "/health")
    add("health", status == 200 and health.strip() == '{"ok":true}', f"{status} {health[:80]}")

    status, body = http("GET", "/no-such-page")
    add("404 status", status == 404, status)
    add("404 disclaimer", DISC in body, "missing")
    add("404 no leak", no_leak(body) and "Something went wrong" not in body and "Page not found" in body, "leak or crash")

    big = b"a=" + b"x" * 80000
    status, body = http("POST", "/login", data=big, headers={"Content-Type": "application/x-www-form-urlencoded"})
    add("413", status == 413 and "Something went wrong" in body and DISC in body and no_leak(body), status)

    status, body = http(
        "POST",
        "/login",
        data=b"email=a&password=b",
        headers={"Content-Type": "application/x-www-form-urlencoded; charset=foo"},
    )
    add("415", status == 415 and "Something went wrong" in body and DISC in body and no_leak(body), status)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        for width in (320, 1024, 1440):
            context = browser.new_context(viewport={"width": width, "height": 900}, device_scale_factor=1)
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda err, w=width: errors.append(f"{w}:{err}"))
            page.goto(BASE + "/login", wait_until="networkidle")
            ov = overflow(page)
            add(f"{width} login overflow", ov["n"] <= 1, ov)
            add(f"{width} login email", "demo@visitsheet.example" in page.content(), "")
            add(f"{width} login disclaimer", DISC in page.content(), "")
            login(page)
            add(f"{width} hello", "Hello, Robin Sample" in page.content(), page.locator("h1").inner_text())
            add(f"{width} next 7", "in 7 days" in page.content(), "")
            ov = overflow(page)
            add(f"{width} dashboard overflow", ov["n"] <= 1, ov)
            href = page.get_attribute(".next-banner a.button", "href")
            page.goto(BASE + href, wait_until="networkidle")
            add(f"{width} access", "How to communicate with me" in page.content() and "Please say one thing at a time." in page.content(), "")
            add(f"{width} edit summary", page.locator("#visit-details").count() == 1, "")
            ov = overflow(page)
            add(f"{width} visit overflow", ov["n"] <= 1, ov)
            page.goto(BASE + href + "/brief", wait_until="networkidle")
            add(f"{width} brief sections", all(s in page.content() for s in [
                "If we only have time for three", "If there is time", "My notes since last time",
                "Medicines I take", "Sample Tablet A", DISC
            ]), "")
            ov = overflow(page)
            add(f"{width} brief overflow", ov["n"] <= 1, ov)
            normal = fonts(page)
            page.goto(BASE + href + "/brief?text=large", wait_until="networkidle")
            large = fonts(page)
            add(f"{width} large-print class", "large-print" in large["body"], large["body"])
            add(f"{width} large-print bigger", float(large["h1"].replace("px", "")) > float(normal["h1"].replace("px", "")), f"{normal['h1']} -> {large['h1']}")
            ov = overflow(page)
            add(f"{width} large-print overflow", ov["n"] <= 1, ov)
            page.goto(BASE + "/medicines", wait_until="networkidle")
            ov = overflow(page)
            add(f"{width} medicines overflow", ov["n"] <= 1, ov)
            add(f"{width} atkinson", "Atkinson" in fonts(page)["family"], fonts(page)["family"])
            add(f"{width} pageerror", not errors, errors)
            context.close()

        # Combined display + large print at 320
        context = browser.new_context(viewport={"width": 320, "height": 900})
        page = context.new_page()
        login(page)
        href = page.get_attribute(".next-banner a.button", "href")
        page.goto(BASE + "/display", wait_until="networkidle")
        page.locator("#large_text").check()
        page.locator("#high_contrast").check()
        page.locator("form[action='/display'] button[type=submit]").click()
        page.wait_for_load_state("networkidle")
        page.goto(BASE + href + "/brief?text=large", wait_until="networkidle")
        combo = fonts(page)
        ov = overflow(page)
        add("320 combo overflow", ov["n"] <= 1, ov)
        add("320 combo classes", "large-print" in combo["body"] and "large-text" in combo["body"] and "high-contrast" in combo["body"], combo["body"])
        add("320 combo h1", float(combo["h1"].replace("px", "")) >= 36, combo["h1"])
        context.close()

        # Interactions, keyboard, print, boundaries on a fresh login at 1440
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        pageerrors = []
        console_bad = []
        page.on("pageerror", lambda err: pageerrors.append(str(err)))
        page.on("console", lambda msg: console_bad.append(msg.text) if msg.type == "error" else None)

        page.goto(BASE + "/login", wait_until="networkidle")
        page.locator("form[action='/login'] button[type=submit]").click()
        page.wait_for_load_state("networkidle")
        add("empty login", "Email is required." in page.content() and "Password is required." in page.content(), "")

        page.locator("#email").fill("demo@visitsheet.example")
        page.locator("#password").fill("wrong-pass")
        page.locator("form[action='/login'] button[type=submit]").click()
        page.wait_for_load_state("networkidle")
        add("bad password", "Email or password is wrong." in page.content(), "")

        login(page)
        href = page.get_attribute(".next-banner a.button", "href")
        page.goto(BASE + href, wait_until="networkidle")

        page.locator("a.button.danger", has_text="Delete visit").focus()
        page.keyboard.press("Tab")
        active = page.evaluate("() => document.activeElement.id")
        add("tab to edit", active == "visit-details", active)
        page.keyboard.press("Enter")
        opened = page.evaluate("() => document.querySelector('details.visit-edit').open")
        page.keyboard.press("Tab")
        active = page.evaluate("() => document.activeElement.id")
        add("enter opens edit", opened and active == "edit-title", f"open={opened} active={active}")

        page.keyboard.press("Escape")
        page.goto(BASE + href, wait_until="networkidle")
        page.locator("a.button.danger", has_text="Delete visit").focus()
        page.keyboard.press("Tab")
        page.keyboard.press(" ")
        page.wait_for_timeout(200)
        opened = page.evaluate("() => document.querySelector('details.visit-edit').open")
        page.keyboard.press("Tab")
        active = page.evaluate("() => document.activeElement.id")
        add("space opens edit", opened and active == "edit-title", f"open={opened} active={active}")

        # keep with-whom on bad date
        page.locator("#edit-title").fill("")
        page.locator("#edit-date").fill("2026-13-40")
        page.locator("#edit-with").fill("Kept Clinician")
        page.locator("form[action$='/details'] button[type=submit]").click()
        page.wait_for_load_state("networkidle")
        add("bad details stay", "Title is required." in page.content() and "Enter a real date" in page.content() and "Kept Clinician" in page.locator("#edit-with").input_value(), "")

        page.goto(BASE + href, wait_until="networkidle")
        before = page.locator("#questions li, #questions .question, li[id^='q-']").count()
        page.locator("button[aria-label='Move question 4 up']").click()
        page.wait_for_load_state("networkidle")
        top = page.locator("ol.questions").first.inner_text()
        add("moved question", "How do I tell the clinic how I communicate?" in top, top[:180])
        page.locator("text=Not asked last time").scroll_into_view_if_needed()
        add("carry offer", "Who do I call if the headache comes back on a weekend?" in page.content(), "")
        page.locator("button", has_text="Add to this visit").click()
        page.wait_for_load_state("networkidle")
        section = page.locator("section[aria-labelledby='questions']").inner_text()
        add("carried", "Who do I call if the headache comes back on a weekend?" in section, section[-240:])

        # diary
        page.locator("#diary-date").fill("2026-10-10")
        page.locator("#diary-text").fill("Practice note, fictional.")
        page.locator("form[action$='/diary'] button[type=submit]").click()
        page.wait_for_load_state("networkidle")
        add("diary added", "Practice note, fictional." in page.content(), "")

        # xss question
        dialogs = []
        page.on("dialog", lambda d: dialogs.append(d.message) or d.dismiss())
        page.locator("#question-text").fill("<script>alert(1)</script>")
        page.locator("form.stack button", has_text="Add question").click()
        page.wait_for_load_state("networkidle")
        add("xss literal", "<script>alert(1)</script>" in page.locator("body").inner_text() and not dialogs, dialogs)

        # new visit empty
        page.goto(BASE + "/dashboard", wait_until="networkidle")
        page.locator("form[action='/visits'] button[type=submit]").click()
        page.wait_for_load_state("networkidle")
        add("empty visit", "Title is required." in page.content(), "")

        # medicine empty
        page.goto(BASE + "/medicines", wait_until="networkidle")
        page.locator("form[action='/medicines'] button[type=submit]").click()
        page.wait_for_load_state("networkidle")
        add("empty medicine", "Name is required." in page.content(), "")

        # about me
        page.goto(BASE + "/about-me", wait_until="networkidle")
        page.locator("#access_note").fill("Please wait if I am writing.")
        page.locator("form[action='/about-me'] button[type=submit]").click()
        page.wait_for_load_state("networkidle")
        add("about me saved", "Please wait if I am writing." in page.content(), "")

        # display logged out
        page.goto(BASE + "/display", wait_until="networkidle")
        page.locator("#large_text").check()
        page.locator("#high_contrast").check()
        page.locator("form[action='/display'] button[type=submit]").click()
        page.wait_for_load_state("networkidle")
        page.locator("form[action='/logout'] button[type=submit]").click()
        page.wait_for_load_state("networkidle")
        classes = page.locator("body").get_attribute("class") or ""
        add("logged out display", "large-text" in classes and "high-contrast" in classes and page.locator("h1").inner_text() == "Log in", classes)

        # print sizes
        page.goto(BASE + "/login?fill=1", wait_until="networkidle")
        page.locator("form[action='/login'] button[type=submit]").click()
        page.wait_for_load_state("networkidle")
        href = page.get_attribute(".next-banner a.button", "href")
        print_fonts = {}
        for label, url in (
            ("normal", href + "/brief"),
            ("large", href + "/brief?text=large"),
        ):
            page.goto(BASE + url, wait_until="networkidle")
            page.emulate_media(media="print")
            printed = fonts(page)
            print_fonts[label] = printed
            letter = OUT / f"{label}-letter.pdf"
            a4 = OUT / f"{label}-a4.pdf"
            page.pdf(path=str(letter), format="Letter", prefer_css_page_size=True, print_background=True)
            page.pdf(path=str(a4), format="A4", prefer_css_page_size=True, print_background=True)
            hidden = page.evaluate("() => getComputedStyle(document.querySelector('.site-header')).display")
            add(f"print header hidden {label}", hidden == "none", hidden)
            page.emulate_media(media="screen")
        add(
            "print large bigger than normal",
            float(print_fonts["large"]["h1"].replace("px", "")) > float(print_fonts["normal"]["h1"].replace("px", ""))
            and float(print_fonts["large"]["disc"].replace("px", "")) > float(print_fonts["normal"]["disc"].replace("px", "")),
            print_fonts,
        )

        add("interaction pageerrors", not pageerrors, pageerrors)
        unexpected = [line for line in console_bad if "Failed to load resource" not in line]
        add("interaction console", not unexpected, unexpected or console_bad)
        context.close()

        # cross-sandbox
        a = browser.new_context()
        b = browser.new_context()
        pa, pb = a.new_page(), b.new_page()
        login(pa)
        login(pb)
        href = pa.get_attribute(".next-banner a.button", "href")
        resp = pb.goto(BASE + href, wait_until="networkidle")
        add("cross sandbox", resp.status == 404 and "Page not found" in pb.content() and DISC in pb.content(), resp.status)
        a.close()
        b.close()
        font_scan(browser)
        browser.close()

    # pdf page counts via pdfinfo done outside if files exist
    (OUT / "results.json").write_text(json.dumps(RESULTS, indent=2))
    failed = [item for item in RESULTS if not item["ok"]]
    print(f"TOTAL {len(RESULTS)} FAIL {len(failed)}", flush=True)
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
