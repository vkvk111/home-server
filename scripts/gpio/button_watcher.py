#!/usr/bin/env python3
"""
button_watcher.py — Long-running GPIO daemon.

Turns the LED on (BCM17) to indicate the system is ready, then watches
the button (BCM27, active-low with internal pull-up) for presses.

Outputs newline-delimited JSON to stdout:
  {"event": "ready",  "led": 17, "button": 27}
  {"event": "press",  "pin": 27}
  {"event": "error",  "message": "..."}

Accepts commands on stdin (one per line):
  LED:1   — turn LED on
  LED:0   — turn LED off
"""

import sys
import json
import threading
import time

LED_PIN = 18
BTN_PIN = 17
DEBOUNCE_MS = 50


def emit(event: str, **kwargs):
    print(json.dumps({"event": event, **kwargs}), flush=True)


def stdin_listener(gpio):
    blink_thread = None

    def do_blink():
        for _ in range(20):          # 20 × 250ms = 5 seconds
            gpio.output(LED_PIN, gpio.HIGH)
            time.sleep(0.125)
            gpio.output(LED_PIN, gpio.LOW)
            time.sleep(0.125)
        # leave LED off after blink sequence

    for line in sys.stdin:
        cmd = line.strip()
        if cmd == "LED:1":
            gpio.output(LED_PIN, gpio.HIGH)
        elif cmd == "LED:0":
            gpio.output(LED_PIN, gpio.LOW)
        elif cmd == "LED:BLINK":
            if blink_thread is None or not blink_thread.is_alive():
                blink_thread = threading.Thread(target=do_blink, daemon=True)
                blink_thread.start()


def main():
    try:
        import RPi.GPIO as GPIO  # type: ignore
    except ImportError:
        emit("error", message="RPi.GPIO not installed")
        sys.exit(1)

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    GPIO.setup(LED_PIN, GPIO.OUT, initial=GPIO.LOW)
    GPIO.setup(BTN_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

    # Turn LED on — system is ready
    GPIO.output(LED_PIN, GPIO.HIGH)
    emit("ready", led=LED_PIN, button=BTN_PIN)

    # Accept LED commands from Node.js via stdin in a background thread
    t = threading.Thread(target=stdin_listener, args=(GPIO,), daemon=True)
    t.start()

    last_state = GPIO.HIGH  # pull-up, idle = HIGH

    try:
        while True:
            state = GPIO.input(BTN_PIN)
            if state != last_state:
                time.sleep(DEBOUNCE_MS / 1000)
                state = GPIO.input(BTN_PIN)
                if state != last_state:
                    if state == GPIO.LOW:
                        emit("press", pin=BTN_PIN)
                    else:
                        emit("release", pin=BTN_PIN)
                    last_state = state
            time.sleep(0.05)  # poll every 50 ms
    except KeyboardInterrupt:
        pass
    finally:
        GPIO.output(LED_PIN, GPIO.LOW)
        GPIO.cleanup()


if __name__ == "__main__":
    main()
