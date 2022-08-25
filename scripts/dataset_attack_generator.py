import csv
import json
from haversine import haversine, Unit
from dateutil import parser
from dateutil.rrule import rrule, MINUTELY
from datetime import timedelta
import random

# We have two location based attacks, one at 07-01 and another at 07-15, both at 12:00 GMT.
# These attacks occur in Houston and New York.  The values in these tuples are (time, lat, lon)
location_based_attacks = [
    [parser.parse("2021-07-01 12:00:00+00:00"), 29.758, -95.381],
    [parser.parse("2021-07-15 12:00:00+00:00"), 40.8, -74.06]
]

# A third attack will be a country wide attack, around this time all events will have a higher likelihood of
# fraud, to simulate a distributed attack from various parts of the country.
attack_3_time = parser.parse("2021-08-03 12:00:00+00:00")

# This will be our fraud score cutoff, we'll generate a random model score for event_label = 0 events from 100
# to fraud_score_cutoff and for event_label = 1, and simulated attack events, we'll generate a model score
# of fraud_score_cutoff to 900
fraud_score_cutoff = 750

# Attack length, how long do the simulated attacks last
attack_length_minutes = 300

# Attack range, in miles
attack_range_miles = 35

# Attack likelihood, during the global attack, in percent
attack_percentage = .05

fraud_min_score = 100
fraud_max_score = 900


def generate_timerange_dict():
    start_time = parser.parse("2021-05-01 00:00:00+00:00")
    end_time = parser.parse("2021-08-28 00:00:00+00:00")
    # 1440 minutes in a day, 1440 / 30 is 30 minute chunks by day.  So that times our number of
    # days is our number of chunks assuming we use 30 minute chunks.  Plus a day for good measure
    chunks = int(((end_time - start_time).days + 1) * (1440 / 30))
    times = [x.timestamp() for x in list(rrule(freq=MINUTELY, interval=30, dtstart=start_time, count=chunks))]
    data_dict = {}
    for t in times:
        data_dict[int(t)] = []
    return data_dict


def calculate_event_time_bucket(ts):
    ts = ts.replace(second=0).replace(microsecond=0)
    if ts.minute < 30:
        if ts.minute < 15:
            ts = ts.replace(minute=0)
        else:
            ts = ts.replace(minute=30)
    else:
        if ts.minute < 45:
            ts = ts.replace(minute=30)
        else:
            ts = ts.replace(minute=0) + timedelta(hours=1)
    return int(ts.timestamp())


def add_point(data_dict, ts_bucket, lat, lon, model_score, event_id):
    if ts_bucket not in data_dict:
        print(f"SOMETHING IS WRONG, {ts_bucket} not in data_dict!")
        exit(1)
    data_dict[ts_bucket] += [lat, lon, model_score, event_id]


def main():
    # For every row in transaction_data_100K_full, we will write the same data to attack_data_modified.csv EXCEPT we will
    # drop the EVENT_LABEL row, and will insert a phony MODEL_SCORE value.  For rows with an even label of 0, we will
    # randomly

    data_dict = generate_timerange_dict()
    events = []

    def calculate_model_score(row):
        for attack in location_based_attacks:
            if abs(attack[0] - t) < timedelta(minutes=attack_length_minutes) \
                    and haversine((lat, lon), (attack[1], attack[2]), Unit.MILES) < attack_range_miles:
                print(f"Location Attack Modification: {row}")
                return random.randint(fraud_score_cutoff, fraud_max_score)

        # Now lets see if we need to flip the score for our country wide attack.
        if abs(attack_3_time - t) < timedelta(minutes=attack_length_minutes) \
                and random.random() < attack_percentage:
            print(f"Global Attack Modification: {row}")
            return random.randint(fraud_score_cutoff, fraud_max_score)

        # If we're still here, return the not-fraud model score
        return random.randint(fraud_min_score, fraud_score_cutoff)

    with open("data.json", "w") as json_output_file:
        with open ("events.json", "w") as event_output_file:
            with open("transaction_data_100K_full.csv", "r") as csv_input_file:
                reader = csv.DictReader(csv_input_file)
                for row in reader:
                    if row["EVENT_LABEL"] == "1":
                        # If the event is already fraud, leave it, we want some
                        # "background fraud" on the map to look realistic.
                        continue

                    t = parser.parse(row["EVENT_TIMESTAMP"])
                    lat = float(row["billing_latitude"])
                    lon = float(row["billing_longitude"])

                    # We don't want to write out the event label to the new file.
                    del(row["EVENT_LABEL"])

                    event_ts_bucket = calculate_event_time_bucket(t)
                    model_score = calculate_model_score(row)
                    add_point(data_dict, event_ts_bucket, lat, lon, model_score, row["EVENT_ID"]);

                    # Add some information that will go in the events.json file
                    row["MODEL_SCORE"] = model_score
                    row["EVENT_TS_BUCKET"] = event_ts_bucket

                    events.append(row)

            # Write our datafiles
            json_output_file.write(json.dumps(data_dict, indent=4))
            event_output_file.write(json.dumps(events, indent=4))


if __name__ == "__main__":
    main()