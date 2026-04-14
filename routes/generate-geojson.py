#!/usr/bin/python3
import csv
import json
import os

class CSVToJson:
    # This class is used to convert a csv file to a json file
    # The csv file must have a header row
    # The output will be a list of dictionaries
    def __init__(self, csv_file, translate_keys=None, dicts_by_key=None):
        self.csv_file = csv_file
        self.translate_keys = translate_keys
        self.dicts = []
        self.dicts_by_key_filter = dicts_by_key
        self.dicts_by_key = {}

    def read_csv(self):
        # Read the csv file and return a list of dictionaries
        with open(self.csv_file, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                self.dicts.append(row)
                if self.dicts_by_key_filter:
                    self.dicts_by_key[row[self.dicts_by_key_filter]] = row


def run():
    this_path = os.path.dirname(os.path.abspath(__file__))
    Airports = CSVToJson(os.path.join(this_path, "airports.csv"), dicts_by_key="ICAO")
    Airports.read_csv()
    filename = os.path.join(this_path, "airports.geojson")
    fstr = ""
    with open(filename, "w") as f:
        f.write("{  \"type\": \"FeatureCollection\",  \"features\": [")
        # Code,Name,ICAO,IATA,Location,CountryISO2,Latitude,Longitude,AltitudeFeet
        for al in Airports.dicts:
            international = 0
            if ("International" in al["Name"]):
                international = 1
            str  = "\n{\"type\": \"Feature\", \"properties\": {\"name\": \"%s\", \"icao\": \"%s\", \"iata\": \"%s\", \"location\": \"%s\", \"country\": \"%s\", \"altitude\": %f, \"international\": %d}," % (al["Name"], al["ICAO"], al["IATA"], al["Location"], al["CountryISO2"], float(al["AltitudeFeet"]) * 0.3048, international)
            str += " \"geometry\": {\"type\": \"Point\", \"coordinates\": [%f, %f]}}," % (float(al["Longitude"]), float(al["Latitude"]))
            fstr += str
            print(al["Name"].replace(" International", ""))
        fstr = fstr[:-1]
        f.write("%s]}\n" % fstr)

            

if __name__ == "__main__":
    run()
