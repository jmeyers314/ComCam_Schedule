import numpy as np
from astropy.time import Time
import astropy.units as u
import json

with open('twilight.json', 'r') as f:
    twilight = json.load(f)

twilight = {t['date']: t for t in twilight}

observations = []

obstypes = {
    "twiflat": {
        "category": "Calibration",
        "label": "Twiflat",
        "tooltip": "Morning twilight flats",
        "url": "http://www.example.com/twiflats.html"
    },
    "prep": {
        "category": "Prep",
        "label": "Prep",
        "tooltip": "Get ready",
        "url": "http://www.example.com/ready.html"
    },
    "sense": {
        "category": "AOS data",
        "label": "Sense",
        "tooltip": "Sensitivity sweeps",
        "url": "http://www.example.com/sense.html"
    },
    "ref": {
        "category": "AOS data",
        "label": "Ref",
        "tooltip": "AOS reference",
        "url": "http://www.example.com/ref.html"
    },
    "focus": {
        "category": "AOS transient",
        "label": "Focus",
        "tooltip": "Focus sweeps",
        "url": "http://www.example.com/focus.html"
    },
    "coord": {
        "category": "AOS transient",
        "label": "Coord",
        "tooltip": "Validate coordinate systems",
        "url": "http://www.example.com/coord.html"
    },
    "LUT": {
        "category": "AOS data",
        "label": "LUT",
        "tooltip": "Look-up table sweeps",
        "url": "http://www.example.com/lut.html"
    },
    "loop": {
        "category": "AOS transient",
        "label": "Loop",
        "tooltip": "Closed-loop optimization",
        "url": "http://www.example.com/loop.html"
    },
    "guider": {
        "category": "IQ",
        "label": "Guider",
        "tooltip": "Guider data",
        "url": "http://www.example.com/guider.html"
    },
    "giant": {
        "category": "AOS data",
        "label": "Giant",
        "tooltip": "Giant donut",
        "url": "http://www.example.com/giant.html"
    },
    "science": {
        "category": "Science",
        "label": "Science",
        "tooltip": "Science Verification data",
        "url": "http://www.example.com/science.html"
    },
}

def add_obs(date, start, end, obstype):
    observations.append(
        {
            "date": date,
            "start_time": start,
            "end_time": end,
            "category": obstypes[obstype]["category"],
            "label": obstypes[obstype]["label"],
            "tooltip": obstypes[obstype]["tooltip"],
            "url": obstypes[obstype]["url"]
        }
    )


# Add prep and twiflats
for day in Time('2024-10-01') + np.arange(61)*u.day:
    date = day.datetime.strftime('%Y-%m-%d')
    twival = twilight[date]
    add_obs(date, twival['sunset'], twival['evening_18deg'], 'prep')
    add_obs(date, twival['morning_18deg'], twival['morning_6deg'], 'twiflat')

# Day 1
date = '2024-10-01'
twival = twilight[date]
add_obs(date, twival['evening_18deg'], twival['evening_18deg']+1, 'coord')
add_obs(date, twival['evening_18deg']+1, twival['evening_18deg']+2, 'focus')
add_obs(date, twival['evening_18deg']+2, twival['evening_18deg']+8, 'sense')
add_obs(date, twival['evening_18deg']+8, twival['morning_18deg'], 'ref')

# Day 2-5 are sense focused
for day in Time('2024-10-02') + np.arange(4)*u.day:
    date = day.datetime.strftime('%Y-%m-%d')
    twival = twilight[date]
    add_obs(date, twival['evening_18deg'], twival['evening_18deg']+1, 'focus')
    add_obs(date, twival['evening_18deg']+1, twival['evening_18deg']+8, 'sense')
    add_obs(date, twival['evening_18deg']+8, twival['morning_18deg'], 'ref')

# Day 6, we've learned to focus faster.  Moving to LUTs
for day in Time('2024-10-02') + np.arange(4, 10)*u.day:
    date = day.datetime.strftime('%Y-%m-%d')
    twival = twilight[date]
    add_obs(date, twival['evening_18deg'], twival['evening_18deg']+0.5, 'focus')
    add_obs(date, twival['evening_18deg']+0.5, twival['evening_18deg']+8, 'LUT')
    add_obs(date, twival['evening_18deg']+8, twival['morning_18deg'], 'ref')

# Day 11.  Time for giant / stuttered / streaked
day = Time('2024-10-02') + 10*u.day
date = day.datetime.strftime('%Y-%m-%d')
twival = twilight[date]
add_obs(date, twival['evening_18deg'], twival['evening_18deg']+0.5, 'focus')
add_obs(date, twival['evening_18deg']+0.5, twival['evening_18deg']+4, 'guider')
add_obs(date, twival['evening_18deg']+4, twival['evening_18deg']+6, 'giant')
add_obs(date, twival['evening_18deg']+6, twival['morning_18deg'], 'science')

# Day 12-15.  Start closed-loop optimization
for day in Time('2024-10-02') + np.arange(11, 15)*u.day:
    date = day.datetime.strftime('%Y-%m-%d')
    twival = twilight[date]
    add_obs(date, twival['evening_18deg'], twival['evening_18deg']+0.5, 'focus')
    add_obs(date, twival['evening_18deg']+0.5, twival['evening_18deg']+6, 'loop')
    add_obs(date, twival['evening_18deg']+6, twival['morning_18deg'], 'science')

with open('observation.json', 'w') as f:
    json.dump(observations, f, indent=2)
