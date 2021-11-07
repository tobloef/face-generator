const fs = require("fs");
const seedrandom = require("seedrandom");
const express = require("express");
const sharp = require("sharp");
const { customAlphabet } = require('nanoid');

const alphabet = 'abcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 10);

let partBufferCache = {};

const setupParts = () => {
	const versionFolderNames = fs.readdirSync("./parts");

	versionFolderNames.forEach((versionFolderName) => {
		const partFolderNames = fs.readdirSync(`./parts/${versionFolderName}`);

		if (partBufferCache[versionFolderName] == null) {
			partBufferCache[versionFolderName] = {};
		}

		partFolderNames.forEach((partFolderName) => {
			if (partBufferCache[versionFolderName][partFolderName] == null) {
				partBufferCache[versionFolderName][partFolderName] = [];
			}

			const partFileNames = fs.readdirSync(`./parts/${versionFolderName}/${partFolderName}`);

			partFileNames.forEach((partFileName) => {
				const partFile = fs.readFileSync(`./parts/${versionFolderName}/${partFolderName}/${partFileName}`);
	
				partBufferCache[versionFolderName][partFolderName].push(partFile);
			});
		});
	});
};

const randomInt = (min, max, random) => {
	return Math.floor(random() * (max - min + 1)) + min;
}

const getRandomImage = async (version, seed, config) => {
	const random = seedrandom(seed);

	const inputBuffers = Object.entries(partBufferCache[version])
		.filter(([key, value]) => {
			return config[key.substring(2,key.length)] != 0
		}).map(([_, buffers]) => {
			const partIndex = randomInt(0, buffers.length - 1, random);
			return buffers[partIndex];
		});

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
	const version = req.params.version ?? "original";
	const seed = req.params.seed === "random" ? nanoid() : req.params.seed;

	if (partBufferCache[version] == null) {
		res.status(404).send(`No version '${version}' found. Try one of these: ${Object.keys(partBufferCache).join(", ")}.`);
		return;
	}

	var config = {}

	if(req.params.seed === "random"){
		for(const property in req.query){
			config[property] = parseInt(req.query[property]);
		}
	}

	const imageData = await getRandomImage(version, seed, config);

	res.contentType('image/png');
	res.set('Seed', seed)
	res.end(imageData, 'binary');
}

const setupExpress = () => {
	const app = express();

	app.get('/:version/:seed.png', handle);
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