from tqdm import tqdm
import numpy as np
from astroplan import Observer, moon_illumination
from astropy.time import Time
import astropy.units as u
import pytz
from datetime import datetime, time

RUBIN = Observer(
    longitude=-70.7494*u.deg, latitude=-30.2444*u.deg,
    elevation=2650.0*u.m, name="LSST",
    timezone="Chile/Continental",
    pressure=750.0*u.mBa,
    temperature=11.5*u.deg_C,
    relative_humidity=0.4
)
cptz = pytz.timezone('America/Santiago')

def secToHHMMSS(sec):
    if sec < 0:
        sec += 86400
    hh = int(sec//3600)
    mm = int((sec%3600)//60)
    ss = int(sec%60)
    return f'{hh:02d}:{mm:02d}:{ss:02d}'

data = []
for dayobs in tqdm(Time('2024-09-01') + np.arange(270)*u.day):
    noon_cp = Time(dayobs) + 15*u.hour
    prevrise = RUBIN.moon_rise_time(noon_cp, which='previous', horizon=0*u.deg)
    prevriseset = RUBIN.moon_set_time(prevrise, which='next', horizon=0*u.deg)
    nextrise = RUBIN.moon_rise_time(noon_cp, which='next', horizon=0*u.deg)
    nextriseset = RUBIN.moon_set_time(nextrise, which='next', horizon=0*u.deg)
    tmid = cptz.localize(
        datetime.combine(
            (dayobs+1*u.d).datetime.date(),
            time(0, 0, 0)
        )
    )
    tmid = Time(tmid)

    prevrise = int((prevrise-tmid).to_value(u.s))
    prevriseset = int((prevriseset-tmid).to_value(u.s))
    nextrise = int((nextrise-tmid).to_value(u.s))
    nextriseset = int((nextriseset-tmid).to_value(u.s))

    intervals = []

    if prevriseset >= -12*3600:
        intervals.append([
            secToHHMMSS(np.clip(prevrise, -12*3600, 12*3600-1)),
            secToHHMMSS(np.clip(prevriseset, -12*3600, 12*3600-1))
        ])

    if nextrise <= 12*3600:
        intervals.append([
            secToHHMMSS(np.clip(nextrise, -12*3600, 12*3600-1)),
            secToHHMMSS(np.clip(nextriseset, -12*3600, 12*3600-1))
        ])

    data.append({
        'dayobs': dayobs.strftime('%Y-%m-%d'),
        'moonintervals': intervals,
        'illumination': moon_illumination(tmid)
    })

import json
with open('moon.json', 'w') as f:
    json.dump(data, f, indent=2)
