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

def secToHHMMSS(sec):
    if sec < 0:
        sec += 86400
    hh = int(sec//3600)
    mm = int((sec%3600)//60)
    ss = int(sec%60)
    return f'{hh:02d}:{mm:02d}:{ss:02d}'

def twilight_for_day(dayobs):
    noon_cp = Time(dayobs) + 15*u.hour
    tmid = cptz.localize(
        datetime.combine(
            (noon_cp+1*u.d).datetime.date(),
            time(0, 0, 0)
        )
    )
    tmid = Time(tmid)

    out = {}
    out['dayobs'] = dayobs
    for label, elev in [
        ('sunset', 0),
        ('evening_6deg', -6),
        ('evening_12deg', -12),
        ('evening_18deg', -18),
    ]:
        out[label] = secToHHMMSS(
            int(
                (
                    RUBIN.sun_set_time(
                        noon_cp, which='next', horizon=elev*u.deg
                    )-tmid
                ).to_value(u.s)
            )
        )


    for label, elev in [
        ('morning_18deg', -18),
        ('morning_12deg', -12),
        ('morning_6deg', -6),
        ('sunrise', 0)
    ]:
        out[label] = secToHHMMSS(
            int(
                (
                    RUBIN.sun_rise_time(
                        noon_cp, which='next', horizon=elev*u.deg
                    )-tmid
                ).to_value(u.s)
            )
        )
    return out


data = []
for dayobs in tqdm(Time('2024-09-01') + np.arange(270)*u.day):
    data.append(twilight_for_day(dayobs.strftime('%Y-%m-%d')))

import json
with open('twilight.json', 'w') as f:
    json.dump(data, f, indent=2)
