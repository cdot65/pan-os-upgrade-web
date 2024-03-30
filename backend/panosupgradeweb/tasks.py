import sys
import os
import django
import logging

from django.contrib.auth import get_user_model

# third party library imports
from environs import Env

# ----------------------------------------------------------------------------
# Configure logging
# ----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s [%(levelname)s] %(message)s"
)

# ----------------------------------------------------------------------------
# Load environment variables from .env file
# ----------------------------------------------------------------------------
env = Env()
env.read_env()

sendgrid_api_key = env(
    "SENDGRID_API_KEY",
    "go to https://docs.sendgrid.com/ui/account-and-settings/api-keys",
)

sys.path.append("/code/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_project.settings")
django.setup()
User = get_user_model()
