const fs = require("fs");
const seedrandom = require("seedrandom");
const express = require("express");
const sharp = require("sharp");
const { customAlphabet } = require('nanoid');

const alphabet = 'abcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 10);

let partBufferFoldersMap = {};

const setupParts = () => {
	const folderNames = fs.readdirSync("./parts");

	folderNames.forEach((folderName) => {
		const partNames = fs.readdirSync(`./parts/${folderName}`);

		if (partBufferFoldersMap[folderName] == null) {
			partBufferFoldersMap[folderName] = {};
		}

		partNames.forEach((partFileName) => {
			const partFile = fs.readFileSync(`./parts/${folderName}/${partFileName}`);
			const partName = partFileName.match(/^(.+?)( [0-9]+)?\.png$/)[1];

			if (partBufferFoldersMap[folderName][partName] == null) {
				partBufferFoldersMap[folderName][partName] = [];
			}
			
			partBufferFoldersMap[folderName][partName].push(partFile);
		});
	});
};

const randomInt = (min, max, random) => {
	return Math.floor(random() * (max - min + 1)) + min;
}

const getRandomImage = async (folder, seed) => {
	const random = seedrandom(seed);

	const inputBuffers = Object.values(partBufferFoldersMap[folder])
		.map((buffers) => {
			const partIndex = randomInt(0, buffers.length - 1, random);
			return buffers[partIndex];
		})

	const { width, height } = await sharp(inputBuffers[0]).metadata();

	return await sharp({
			create: {
				width,
				height,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			}
		})
		.composite(inputBuffers.map((buffer) => ({input: buffer})))
		.png()
		.toBuffer();
};

const handle = async (req, res) => {
	const folder = req.params.folder ?? "original";
	const seed = req.params.seed === "random" ? nanoid() : req.params.seed;

	if (partBufferFoldersMap[folder] == null) {
		res.status(404).send(`No version '${folder}' found. Try one of these: ${Object.keys(partBufferFoldersMap).join(", ")}.`);
		return;
	}

	const imageData = await getRandomImage(folder, seed);

	res.contentType('image/png');
	res.set('Seed', seed)
	res.end(imageData, 'binary');
}

const setupExpress = () => {
	const app = express();

	app.get('/:folder/:seed.png', handle);
	app.get('/:seed.png', handle);

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