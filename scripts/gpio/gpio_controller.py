#!/usr/bin/env python3
"""
gpio_controller.py — CLI bridge between Node.js and RPi.GPIO.

Usage:
  python3 gpio_controller.py setup <pin> <IN|OUT>
  python3 gpio_controller.py read  <pin>
  python3 gpio_controller.py write <pin> <0|1>

Always writes a single JSON object to stdout.
"""

import sys
import json


def result(data: dict):
    print(json.dumps(data))
    sys.stdout.flush()


def error(msg: str, code: int = 1):
    result({"error": msg})
    sys.exit(code)


def main():
    args = sys.argv[1:]

    if not args:
        error("No action provided. Use: setup | read | write")

    action = args[0].lower()

    try:
        import RPi.GPIO as GPIO  # type: ignore
    except ImportError:
        error("RPi.GPIO is not installed. Run: pip3 install RPi.GPIO")

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)

    try:
        if action == "setup":
            if len(args) < 3:
                error("Usage: setup <pin> <IN|OUT>")
            pin = int(args[1])
            direction_str = args[2].upper()
            direction = GPIO.IN if direction_str == "IN" else GPIO.OUT
            GPIO.setup(pin, direction)
            result({"success": True, "pin": pin, "direction": direction_str})

        elif action == "read":
            if len(args) < 2:
                error("Usage: read <pin>")
            pin = int(args[1])
            value = GPIO.input(pin)
            result({"pin": pin, "value": value})

        elif action == "write":
            if len(args) < 3:
                error("Usage: write <pin> <0|1>")
            pin = int(args[1])
            value = int(args[2])
            if value not in (0, 1):
                error("value must be 0 or 1")
            GPIO.output(pin, value)
            result({"success": True, "pin": pin, "value": value})

        else:
            error(f"Unknown action: {action}")

    except ValueError as exc:
        error(f"Invalid argument: {exc}")
    except Exception as exc:  # noqa: BLE001
        error(str(exc))
    finally:
        # Do not call GPIO.cleanup() here so that pin state persists between calls.
        pass


if __name__ == "__main__":
    main()
