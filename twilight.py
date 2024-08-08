from tqdm import tqdm
import numpy as np
from astroplan import Observer
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

def twilight_for_day(date):
    noon_cp = Time(date) + 15*u.hour
    tmid = cptz.localize(
        datetime.combine(
            (noon_cp+1*u.d).datetime.date(),
            time(0, 0, 0)
        )
    )
    tmid = Time(tmid)

    out = {}
    out['date'] = date
    for label, elev in [
        ('sunset', 0),
        ('evening_6deg', -6),
        ('evening_12deg', -12),
        ('evening_18deg', -18),
    ]:
        out[label] = (RUBIN.sun_set_time(
            noon_cp, which='next', horizon=elev*u.deg
        )-tmid).to_value(u.h)


    for label, elev in [
        ('morning_18deg', -18),
        ('morning_12deg', -12),
        ('morning_6deg', -6),
        ('sunrise', 0)
    ]:
        out[label] = (RUBIN.sun_rise_time(
            noon_cp, which='next', horizon=elev*u.deg
        )-tmid).to_value(u.h)
    return out


data = []
for date in tqdm(Time('2024-09-01') + np.arange(180)*u.day):
    data.append(twilight_for_day(date.strftime('%Y-%m-%d')))

import json
with open('twilight.json', 'w') as f:
    json.dump(data, f, indent=2)
