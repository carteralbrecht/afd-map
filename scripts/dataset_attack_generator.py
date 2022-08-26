import csv
import json
from haversine import haversine, Unit
from dateutil import parser
from dateutil.rrule import rrule, MINUTELY
from datetime import timedelta
import random

# We have two location based attacks, one at 07-01 and another at 07-15, both at 12:00 GMT.
# These attacks occur in Houston and New York.  The values in these tuples are (time, lat, lon)

min_time = parser.parse("2021-05-10 12:00:00+00:00")
max_time = parser.parse("2021-07-20 12:00:00+00:00")

location_based_attacks = [
    [parser.parse("2021-07-01 12:00:00+00:00"), 29.758, -95.381],
    [parser.parse("2021-07-15 12:00:00+00:00"), 40.8, -74.06]
]

# A third attack will be a country wide attack, around this time all events will have a higher likelihood of
# fraud, to simulate a distributed attack from various parts of the country.
attack_3_time = parser.parse("2021-07-17 12:00:00+00:00")

# Attack length, how long do the simulated attacks last
attack_length_minutes = 300

# Attack range, in miles
attack_range_miles = 35

# Attack likelihood, during the global attack, in percent
attack_percentage = .05

# When we generate a fake fraud score, we'll make it 900
generated_fraud_score = 900


def read_model_scores():
    model_score_dict = {}
    with open("transaction_data_100K_bp_output.csv", "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            model_score_dict[row["EVENT_ID"]] = float(row["MODEL_SCORES"].split(":")[1].split("}")[0].strip())
    return model_score_dict


def generate_timerange_dict():
    # 1440 minutes in a day, 1440 / 30 is 30 minute chunks by day.  So that times our number of
    # days is our number of chunks assuming we use 30 minute chunks.  Plus a day for good measure
    chunks = int(((max_time - min_time).days + 1) * (1440 / 30))
    times = [x.timestamp() for x in list(rrule(freq=MINUTELY, interval=30, dtstart=min_time, count=chunks))]
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


def add_point(data_dict, ts_bucket, lat, lon, model_score):
    if ts_bucket not in data_dict:
        print(f"SOMETHING IS WRONG, {ts_bucket} not in data_dict!")
        exit(1)
    data_dict[ts_bucket] += [lat, lon, model_score]


def main():
    # For every row in transaction_data_100K_full, we will write the same data to attack_data_modified.csv EXCEPT we will
    # drop the EVENT_LABEL row, and will insert a phony MODEL_SCORE value.  For rows with an even label of 0, we will
    # randomly

    data_dict = generate_timerange_dict()
    events = []
    model_scores_dict = read_model_scores()
    print("MIN TIME IS " + str(int(min_time.timestamp())))
    print("MAX TIME IS " + str(int(max_time.timestamp())))

    def calculate_model_score(row):
        for attack in location_based_attacks:
            if abs(attack[0] - t) < timedelta(minutes=attack_length_minutes) \
                    and haversine((lat, lon), (attack[1], attack[2]), Unit.MILES) < attack_range_miles:
                print(f"Location Attack Modification: {row}")
                return generated_fraud_score

        # Now lets see if we need to flip the score for our country wide attack.
        if abs(attack_3_time - t) < timedelta(minutes=attack_length_minutes) \
                and random.random() < attack_percentage:
            print(f"Global Attack Modification: {row}")
            return generated_fraud_score

        # If we're still here, return the real model score
        return model_scores_dict[row["EVENT_ID"]]

    with open("data.json", "w") as json_output_file:
        with open ("events.json", "w") as event_output_file:
            with open("transaction_data_100K_full.csv", "r") as csv_input_file:
                reader = csv.DictReader(csv_input_file)
                for row in reader:
                    t = parser.parse(row["EVENT_TIMESTAMP"])
                    if t < min_time or t > max_time:
                        continue

                    lat = float(row["billing_latitude"])
                    lon = float(row["billing_longitude"])

                    # We don't want to write out these values to the new file, as they aren't displayed in the webapp:
                    del(row["EVENT_LABEL"])
                    del(row["EVENT_TIMESTAMP"])
                    del(row["LABEL_TIMESTAMP"])
                    del(row["ENTITY_TYPE"])
                    del(row["ENTITY_ID"])
                    del(row["card_bin"])
                    del(row["billing_street"])
                    del(row["billing_city"])
                    del(row["billing_state"])
                    del(row["billing_zip"])
                    del(row["user_agent"])

                    event_ts_bucket = calculate_event_time_bucket(t)
                    model_score = calculate_model_score(row)
                    add_point(data_dict, event_ts_bucket, lat, lon, model_score)

                    # Add some information that will go in the events.json file
                    row["MODEL_SCORE"] = model_score
                    row["EVENT_TS_BUCKET"] = event_ts_bucket

                    events.append(row)

            # Write our datafiles
            json_output_file.write(json.dumps(data_dict, indent=4))
            event_output_file.write(json.dumps(events))


if __name__ == "__main__":
    main()