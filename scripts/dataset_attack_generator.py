import csv
from haversine import haversine, Unit
from dateutil import parser
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

# For every row in transaction_data_100K_full, we will write the same data to attack_data_modified.csv EXCEPT we will
# drop the EVENT_LABEL row, and will insert a phony MODEL_SCORE value.  For rows with an even label of 0, we will
# randomly
with open("attack_data_modified.csv", "w") as csv_output_file:
    with open("transaction_data_100K_full.csv", "r") as csv_input_file:
        reader = csv.DictReader(csv_input_file)
        writer = csv.DictWriter(csv_output_file,
                                fieldnames=[x for x in reader.fieldnames if x != "EVENT_LABEL"] + ["MODEL_SCORE"])
        writer.writeheader()
        for row in reader:
            if row["EVENT_LABEL"] == "1":
                # If the event is already fraud, leave it, we want some "background fraud" on the map to look realistic.
                continue

            t = parser.parse(row["EVENT_TIMESTAMP"])
            lat = float(row["billing_latitude"])
            lon = float(row["billing_longitude"])

            # We don't want to write out the event label to the new file.
            del(row["EVENT_LABEL"])

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

            row["MODEL_SCORE"] = calculate_model_score(row)
            writer.writerow(row)
