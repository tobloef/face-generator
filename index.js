const fs = require("fs");
const seedrandom = require("seedrandom");
const express = require("express");
const sharp = require("sharp");

const PARTS_FOLDER_PATH = "./parts";
const IMAGE_WIDTH = 100;
const IMAGE_HEIGHT = 100;

const PART_CONFIGS = {
	background: {
		occurrenceChance: 0,
	},
	head: {
		occurrenceChance: 1,
	},
	mouth: {
		occurrenceChance: 0.95,
	},
	eyes: {
		occurrenceChance: 1,
	},
	nose: {
		occurrenceChance: 0.95,
	},
	headgear: {
		occurrenceChance: 0.33,
	},
};

let partBuffersMap;

const getTotalCombinations = () => {
	return Object.entries(partBuffersMap)
		.reduce((acc, [key, array]) => {
			let newChoices = array.length;
			if (PART_CONFIGS[key].occurrenceChance !== 1) {
				newChoices += 1;
			}
			return acc * newChoices;
		}, 1)
}

const setupParts = () => {
	console.info("Reading part files...");

	const partFileNames = fs.readdirSync(PARTS_FOLDER_PATH);

	const emptyPartBufferMap = Object.keys(PART_CONFIGS)
		.reduce((acc, partKey) => {
			acc[partKey] = [];
			return acc;
		}, {});

	partBuffersMap = partFileNames.reduce((acc, partFileName) => {
		const partFile = fs.readFileSync(`${PARTS_FOLDER_PATH}/${partFileName}`);
		const partKeyToUse = Object.keys(PART_CONFIGS)
			.find((partKey) => {
				const fileNameRegex = new RegExp(`^${partKey}( [0-9]+)?.png$`, "i");
				return fileNameRegex.test(partFileName);
			});
		if (partKeyToUse == null) {
			throw new Error(`Invalid parts file name "${partFileName}".`)
		}
		acc[partKeyToUse].push(partFile);
		return acc;
	}, emptyPartBufferMap);

	const partCounts = Object.entries(partBuffersMap)
		.map(([key, array]) => `${key}: ${array.length}`)
		.join(", ");

	const combinations = getTotalCombinations();

	console.info(`Loaded (${partCounts}) parts.`);
	console.info(`That's ${combinations.toLocaleString('en-US')} total combinations!`);
};

const randomInt = (min, max, random) => {
	return Math.floor(random() * (max - min + 1)) + min;
}

const getRandomImage = async (seed) => {
	const random = seedrandom(seed);

	const inputBuffers = Object.entries(PART_CONFIGS)
		.reduce((acc, [key, config]) => {
			const isOccouring = random() <= config.occurrenceChance;
			if (!isOccouring) {
				return acc;
			}

			const partIndex = randomInt(0, partBuffersMap[key].length - 1, random);
			const partBuffer = partBuffersMap[key][partIndex];

			acc.push(partBuffer);

			return acc;
		}, []);

	return await sharp({
			create: {
				width: IMAGE_WIDTH,
				height: IMAGE_HEIGHT,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			}
		})
		.composite(
			inputBuffers.map((buffer) => ({input: buffer}))
		)
		.png()
		.toBuffer();
};

const setupExpress = () => {
	const app = express();

	app.get('/:seed.png', async (req, res) => {
		let seed = req.params.seed === "random"
			? Math.random()
			: req.params.seed;

		const imageData = await getRandomImage(seed);

		res.contentType('image/png');
		res.end(imageData, 'binary');
	});

	const port = process.env.PORT || 1234;

	app.listen(port, () => {
		console.info(`Started image API on port ${port}.`);
	});
};

const main = () => {
	setupParts();
	setupExpress();
};

main();