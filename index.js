const fs = require("fs");
const path = require("path");
const csv = require("fast-csv");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const crypto = require("crypto");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const argv = yargs(hideBin(process.argv))
  .option("f", {
    alias: "file",
    demandOption: true,
    describe: "The path to the input CSV file",
    type: "string",
  })
  .option("o", {
    alias: "output",
    demandOption: false,
    describe: "The path to the input CSV file",
    type: "string",
    default: ".",
  })
  .usage(
    "Usage: $0 --file [csv file path] --output [output directory for the JSON files]"
  ).argv;

let csvWriter;
const records = [];
const filePath = argv.file;
const filename = path.basename(filePath, ".csv");
const outputDir = argv.output; //? argv.output : ".";

fs.createReadStream(filePath)
  .pipe(csv.parse({ headers: true }))
  .on("headers", (headers) => {
    headers.push("Hash");

    csvWriter = createCsvWriter({
      path: `${filename}.output.csv`,
      header: headers,
    });

    const headerRow = {};
    headers.forEach((col) => {
      headerRow[col] = col;
    });

    headerRow["Hash"] = "Hash";
    records.push(headerRow);
  })
  .on("data", (row) => {
    if (row["Filename"]) {
      const jsonData = {
        format: "CHIP-0007",
        name: row["Name"],
        description: row["Description"],
        series_number: row["Series Number"],
        attributes: [
          {
            trait_type: "gender",
            value: row["Gender"],
          },
        ],
        collection: {
          name: "Zuri NFT Tickets for Free Lunch",
          id: "b774f676-c1d5-422e-beed-00ef5510c64d",
          attributes: [
            {
              type: "description",
              value: "Rewards for accomplishments during HNGi9.",
            },
          ],
        },
      };

      // Add more attributes field if available
      if (row["Attributes"]) {
        const attributes = [];
        row["Attributes"].split(",").forEach((attribute) => {
          if (attribute) {
            try {
              const values = attribute.split(":");
              const traitType = values[0].trim();
              const value = values[1].trim();

              attributes.push({
                trait_type: traitType,
                value: value,
              });
            } catch (err) {
              // this was most likely caused by bad input
              console.log("Invalid attribute format: ", attribute);
            }
          }
        });

        jsonData["attributes"] = attributes;
      }

      const stringifiedJson = JSON.stringify(jsonData);

      // Hash the JSON data
      const hashedJson = crypto
        .createHash("sha256")
        .update(stringifiedJson)
        .digest("hex");

      // Create the JSON file
      fs.writeFileSync(`${outputDir}/${row["Filename"]}.json`, stringifiedJson);

      // Store the hash and the record to our list
      row["Hash"] = hashedJson;
      records.push(row);
    } else {
      // this is not a row that needs to be processed
      // just add it to the records so that we do not skip it when regenerating the CSV
      records.push(row);
    }
  })
  .on("close", () => {
    csvWriter
      .writeRecords(records)
      .then(() => console.log("Processing done!"))
      .catch((err) => {
        console.log("Oops! Something went wrong", err);
      });
  })
  .on("error", (err) => {
    console.log("Oops! Something went wrong", err);
  });
