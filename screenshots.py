#!/usr/bin/env python3
"""Capture screenshots of the padel app for the presentation."""
import os
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3002"
OUT = "/docker/data_dockers/padel_app/screenshots"
os.makedirs(OUT, exist_ok=True)

def select_plan(page, plan_name):
    """Navigate to planes, click the plan button to set context."""
    page.goto(f"{BASE}/planes")
    page.wait_for_timeout(3000)
    page.get_by_text(f"Probar {plan_name}").click()
    page.wait_for_timeout(3000)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])

    # --- Plans page (no plan needed) ---
    print("  Capturing planes.png ...")
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    page.goto(f"{BASE}/planes")
    page.wait_for_timeout(4000)
    page.screenshot(path=f"{OUT}/planes.png", full_page=True)
    page.close()

    # --- Elite screenshots ---
    for fname, path in [
        ("dashboard_elite.png", "/"),
        ("dashboard_elite_full.png", "/"),
        ("calendario.png", "/calendario"),
        ("clases.png", "/clases"),
        ("alumnos.png", "/alumnos"),
        ("recuperaciones.png", "/recuperaciones"),
        ("notificaciones.png", "/notificaciones"),
    ]:
        print(f"  Capturing {fname} ...")
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        select_plan(page, "Elite")
        if path != "/":
            page.goto(f"{BASE}{path}")
            page.wait_for_timeout(4000)
        else:
            page.wait_for_timeout(2000)
        full = "full" in fname
        page.screenshot(path=f"{OUT}/{fname}", full_page=full or True)
        page.close()

    # --- Club dashboard ---
    print("  Capturing dashboard_club.png ...")
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    select_plan(page, "Club")
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{OUT}/dashboard_club.png", full_page=True)
    page.close()

    # --- Starter dashboard ---
    print("  Capturing dashboard_starter.png ...")
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    select_plan(page, "Starter")
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{OUT}/dashboard_starter.png", full_page=True)
    page.close()

    browser.close()
    print("Done! Screenshots saved to", OUT)
