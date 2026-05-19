import os
import requests
from datetime import datetime

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")


def send_cascade_alert(chain):
    """
    Sends cascade failure alert to Slack.
    """

    if not SLACK_WEBHOOK_URL:
        print("Slack webhook URL not configured")
        return

    try:
        affected = chain.get("affected_pods", [])
        root = chain.get("root_cause", "Unknown")
        severity = chain.get("severity", "high")

        message = {
            "text": "⚠️ Industrial Edge Sentinel Alert",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "⚡ Cascade Failure Detected"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Root Cause:*\n{root}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Severity:*\n{severity.upper()}"
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Affected Pods:*\n{', '.join(affected)}"
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": f"Industrial Edge Sentinel • {datetime.utcnow()}"
                        }
                    ]
                }
            ]
        }

        response = requests.post(
            SLACK_WEBHOOK_URL,
            json=message,
            timeout=5
        )

        print("Slack alert sent:", response.status_code)

    except Exception as e:
        print("Slack alert failed:", e)