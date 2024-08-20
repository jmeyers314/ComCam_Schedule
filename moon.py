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

    intervals = []
    intervals.append([
         (prevrise-tmid).to_value(u.h),
         (prevriseset-tmid).to_value(u.h)
    ])
    intervals.append([
        (nextrise-tmid).to_value(u.h),
        (nextriseset-tmid).to_value(u.h)
    ])
    if intervals[0][1] < -12:
        del intervals[0]
    elif intervals[1][0] > 12:
        del intervals[1]

    data.append({
        'dayobs': dayobs.strftime('%Y-%m-%d'),
        'moonintervals': intervals,
        'illumination': moon_illumination(tmid)
    })

import json
with open('moon.json', 'w') as f:
    json.dump(data, f, indent=2)
