import logging

from django.utils import timezone

from panosupgradeweb.models import Job, JobLogEntry


def get_emoji(
    action: str,
) -> str:
    """
    Maps specific action keywords to their corresponding emoji symbols for enhanced log and user interface messages.

    This utility function is designed to add visual cues to log messages or user interface outputs by associating
    specific action keywords with relevant emoji symbols. It aims to improve the readability and user experience by
    providing a quick visual reference for the action's nature or outcome. The function supports a predefined set of
    keywords, each mapping to a unique emoji. If an unrecognized keyword is provided, the function returns an empty
    string to ensure seamless operation without interrupting the application flow.

    Parameters ---------- action : str A keyword representing the action or status for which an emoji is required.
    Supported keywords include 'success', 'error', 'warning', 'working', 'report', 'search', 'save', 'stop',
    and 'start'.

    Returns ------- str The emoji symbol associated with the specified action keyword. Returns an empty string if the
    keyword is not recognized, maintaining non-disruptive output.

    Examples
    --------
    Adding visual cues to log messages:
        >>> logging.info(f"{get_emoji(action='success')} Operation successful.")
        >>> logging.error(f"{get_emoji(action='error')} An error occurred.")

    Enhancing user prompts in a command-line application:
        >>> print(f"{get_emoji(action='start')} Initiating the process.")
        >>> print(f"{get_emoji(action='stop')} Process terminated.")

    Notes ----- - The function enhances the aesthetic and functional aspects of textual outputs, making them more
    engaging and easier to interpret at a glance. - It is implemented with a fail-safe approach, where unsupported
    keywords result in an empty string, thus preserving the integrity and continuity of the output. - Customization
    or extension of the supported action keywords and their corresponding emojis can be achieved by modifying the
    internal emoji_map dictionary.

    This function is not expected to raise any exceptions, ensuring stable and predictable behavior across various
    usage contexts.
    """

    emoji_map = {
        "debug": "🐛",
        "error": "❌",
        "info": "ℹ️",
        "report": "📊",
        "save": "💾",
        "search": "🔍",
        "skipped": "⏭️",
        "start": "🚀",
        "stop": "🛑",
        "success": "✅",
        "warning": "⚠️",
        "working": "⏳",
    }
    return emoji_map.get(action, "")


class PanOsUpgradeLogger(logging.Logger):
    """
    A custom logger class for logging upgrade-related messages.

    This class extends the built-in logging.Logger class and provides additional functionality
    for logging upgrade-related messages. It includes methods to set the job ID, log tasks with
    emojis, and save logs to the database.

    Attributes:
        name (str): The name of the logger.
        level (int): The logging level (default: logging.NOTSET).
        sequence_number (int): The sequence number for log messages.
        job_id (str): The ID of the job associated with the upgrade.

    Methods:
        __init__: Initialize the UpgradeLogger instance.
        get_emoji: Map specific action keywords to their corresponding emoji symbols.
        log_task: Log a task message with an emoji and extra information.
        set_job_id: Set the job ID for the logger.
    """

    def __init__(self, name, level=logging.NOTSET):
        super().__init__(name, level)
        self.sequence_number = 0
        self.job_id = None

    def log_task(self, action, message):
        emoji = get_emoji(action=action)
        message = f"{emoji} {message}"

        level_mapping = {
            "debug": logging.DEBUG,
            "info": logging.INFO,
            "warning": logging.WARNING,
            "error": logging.ERROR,
            "critical": logging.CRITICAL,
        }
        severity_level = action
        level = level_mapping.get(action, logging.INFO)

        timestamp = timezone.now()

        # Save the log entry to the database
        try:
            job = Job.objects.get(task_id=self.job_id)
            log_entry = JobLogEntry(
                job=job,
                timestamp=timestamp,
                severity_level=severity_level,
                message=message,
            )
            log_entry.save()
        except Job.DoesNotExist:
            pass

        self.log(level, message)
        self.sequence_number += 1

    def set_job_id(self, job_id):
        self.job_id = job_id
