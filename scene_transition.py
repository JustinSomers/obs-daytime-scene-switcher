import time
from datetime import datetime
from obswebsocket import obsws, requests

# OBS WebSocket connection settings
OBS_HOST = "localhost"
OBS_PORT = 4444  # Default WebSocket port for OBS
OBS_PASSWORD = "your_password_here"

# Scene names in OBS
SCENES = {
    "daytime": "Daytime Scene",
    "evening": "Evening Scene",
    "nighttime": "Nighttime Scene"
}

# Transition times (24-hour format)
SCHEDULE = {
    "daytime_start": "06:00",
    "evening_start": "18:00",
    "nighttime_start": "22:00"
}

def get_current_scene():
    """Determine which scene should be active based on the current time."""
    now = datetime.now().strftime("%H:%M")
    if SCHEDULE["daytime_start"] <= now < SCHEDULE["evening_start"]:
        return SCENES["daytime"]
    elif SCHEDULE["evening_start"] <= now < SCHEDULE["nighttime_start"]:
        return SCENES["evening"]
    else:
        return SCENES["nighttime"]

def main():
    # Connect to OBS WebSocket
    ws = obsws(OBS_HOST, OBS_PORT, OBS_PASSWORD)
    ws.connect()

    try:
        current_scene = None
        while True:
            # Determine the correct scene
            new_scene = get_current_scene()

            # If the scene has changed, switch scenes with a fade transition
            if new_scene != current_scene:
                ws.call(requests.SetCurrentScene(new_scene))
                ws.call(requests.SetTransition("Fade"))
                print(f"Switched to scene: {new_scene}")
                current_scene = new_scene

            # Check again after 1 minute
            time.sleep(60)

    except KeyboardInterrupt:
        print("Script stopped.")
    finally:
        ws.disconnect()

if __name__ == "__main__":
    main()
