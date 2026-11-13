import os

from flask import Flask, redirect, render_template

app = Flask(__name__)

SEARCH_SERVICE_URL = os.getenv("SEARCH_SERVICE_URL", "http://localhost:5006")
PROFILES_SERVICE_URL = os.getenv("PROFILES_SERVICE_URL", "http://localhost:5005")
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://127.0.0.1:5000")
ORGANIZATIONS_SERVICE_URL = os.getenv("ORGANIZATIONS_SERVICE_URL", "http://localhost:5004")

@app.context_processor
def inject_service_urls():
    # the navbar (on every page) needs these to show the profile picture and log out
    return {
        "nav_profiles_url": PROFILES_SERVICE_URL,
        "nav_auth_url": AUTH_SERVICE_URL,
    }

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/about-us")
def about():
    return render_template("about-us.html")

@app.route("/login")
def login():
    return render_template("login.html")

@app.route("/signup")
def signup():
    return render_template("signup.html")

@app.route("/search")
def search():
    return render_template("search.html", search_service_url=SEARCH_SERVICE_URL)

@app.route("/profile")
def profile_index():
    # profiles are opened from search results, so send bare /profile there
    return redirect("/search")

@app.route("/profile/edit")
def profile_edit():
    return render_template("edit-profile.html", profiles_service_url=PROFILES_SERVICE_URL)

@app.route("/profile/<user_id>")
def profile(user_id):
    return render_template(
        "profile.html",
        profiles_service_url=PROFILES_SERVICE_URL,
        user_id=user_id,
    )

@app.route("/settings")
def settings():
    return render_template("settings.html", organizations_service_url=ORGANIZATIONS_SERVICE_URL)

@app.route("/verify-organization/<token>")
def verify_organization(token):
    return render_template(
        "verify-organization.html",
        organizations_service_url=ORGANIZATIONS_SERVICE_URL,
        token=token,
    )
