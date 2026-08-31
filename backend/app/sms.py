import logging

logger = logging.getLogger("reflex.sms")


def send_sms(phone: str, message: str) -> None:
    """
    Stub for the sprint: no live Africa's Talking (or similar) account
    wired up. In a real deployment this is a single function to swap out —
    everything upstream just calls send_sms() and doesn't know the
    difference. Logged here so it's visible in the demo that the hook
    exists and fires at the right moments.
    """
    logger.info(f"[SMS STUB] to={phone} message={message!r}")
