import numpy as np
from astropy.time import Time
import astropy.units as u
import json

with open('twilight.json', 'r') as f:
    twilight = json.load(f)

twilight = {t['date']: t for t in twilight}

observations = []

def add_obs(date, start, end, obstype):
    observations.append(
        {
            "date": date,
            "start_time": start,
            "end_time": end,
            "obstype": obstype,
            "filters": [],
            "notes": "",
        }
    )

# Add prep and twiflats
for day in Time('2024-10-01') + np.arange(61)*u.day:
    date = day.datetime.strftime('%Y-%m-%d')
    twival = twilight[date]
    add_obs(date, twival['sunset'], twival['evening_18deg'], 'Prep')
    add_obs(date, twival['morning_18deg'], twival['morning_6deg'], 'Twiflat')

# Day 1
date = '2024-10-01'
twival = twilight[date]
add_obs(date, twival['evening_18deg'], twival['evening_18deg']+1, 'Dome slit')
add_obs(date, twival['evening_18deg']+1, twival['evening_18deg']+2, 'M1M3 cover')
add_obs(date, twival['evening_18deg']+2, twival['evening_18deg']+3, 'Focus')
add_obs(date, twival['evening_18deg']+3, twival['evening_18deg']+8, 'Sense')
add_obs(date, twival['evening_18deg']+8, twival['morning_18deg'], 'Ref')

# Day 2-5 are sense focused
for day in Time('2024-10-02') + np.arange(4)*u.day:
    date = day.datetime.strftime('%Y-%m-%d')
    twival = twilight[date]
    add_obs(date, twival['evening_18deg'], twival['evening_18deg']+1, 'Focus')
    add_obs(date, twival['evening_18deg']+1, twival['evening_18deg']+8, 'Sense')
    add_obs(date, twival['evening_18deg']+8, twival['morning_18deg'], 'Ref')

# Day 6, we've learned to focus faster.  Moving to LUTs
for day in Time('2024-10-02') + np.arange(4, 10)*u.day:
    date = day.datetime.strftime('%Y-%m-%d')
    twival = twilight[date]
    add_obs(date, twival['evening_18deg'], twival['evening_18deg']+0.5, 'Focus')
    add_obs(date, twival['evening_18deg']+0.5, twival['evening_18deg']+8, 'LUT')
    add_obs(date, twival['evening_18deg']+8, twival['morning_18deg'], 'Ref')

# Day 11.  Time for giant / stuttered / streaked
day = Time('2024-10-02') + 10*u.day
date = day.datetime.strftime('%Y-%m-%d')
twival = twilight[date]
add_obs(date, twival['evening_18deg'], twival['evening_18deg']+0.5, 'Focus')
add_obs(date, twival['evening_18deg']+0.5, twival['evening_18deg']+4, 'Guide')
add_obs(date, twival['evening_18deg']+4, twival['evening_18deg']+6, 'Giant')
add_obs(date, twival['evening_18deg']+6, twival['morning_18deg'], 'Survey')

# Day 12-15.  Start closed-loop optimization
for day in Time('2024-10-02') + np.arange(11, 15)*u.day:
    date = day.datetime.strftime('%Y-%m-%d')
    twival = twilight[date]
    add_obs(date, twival['evening_18deg'], twival['evening_18deg']+0.5, 'Focus')
    add_obs(date, twival['evening_18deg']+0.5, twival['evening_18deg']+6, 'Loop')
    add_obs(date, twival['evening_18deg']+6, twival['morning_18deg'], 'Survey')

with open('observation.json', 'w') as f:
    json.dump(observations, f, indent=2)
