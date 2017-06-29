/* jshint esversion: 6 */

"use strict";

// Use seperate scope to prevent global scope pollution
(function () {
	const cookie = require("cookie");

	var config = {};

	// Parse command line arguments, if any
	var addressIndex = process.argv.indexOf("--address");
	var portIndex = process.argv.indexOf("--port");

	if (addressIndex > -1) {
		config.address = process.argv[addressIndex + 1];
	} else {
		fail();
	}
	if (portIndex > -1) {
		config.port = process.argv[portIndex + 1];
	} else {
		fail();
	}

	function fail(message, code = 1) {
		if (message !== undefined && typeof message === "string") {
			console.log(message);
		} else {
			console.log("Usage: 'node clientonly --address 192.168.1.10 --port 8080'");
		}
		process.exit(code);
	}

	function getServerConfig(url) {
		// Return new pending promise
		return new Promise((resolve, reject) => {
			// Select http or https module, depending on reqested url
			const lib = url.startsWith("https") ? require("https") : require("http");
			const request = lib.get(url, (response) => {
				var configData = "";

				// Gather incomming data
				response.on("data", function(chunk) {
					configData += chunk;
				});
				// Resolve promise at the end of the HTTP/HTTPS stream
				response.on("end", function() {
					resolve(JSON.parse(configData));
				});
			});

			request.on("error", function(error) {
				reject(new Error(`Unable to read config from server (${url} (${error.message}`));
			});
		})
	};

	// Only start the client if a non-local server was provided
	if (["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1", undefined].indexOf(config.address) === -1) {
		getServerConfig(`http://${config.address}:${config.port}/config/`)
			.then(function (config) {
				// Pass along the server config via an environment variable
				var env = Object.create(process.env);
				var options = { env: env };
				config.address = config.address;
				config.port = config.port;
				env.config = JSON.stringify(config);

				// Spawn electron application
				const electron = require("electron");
				const child = require("child_process").spawn(electron, ["js/electron.js"], options);

				// Pipe all child process output to current stdout
				child.stdout.on("data", function (buf) {
					process.stdout.write(`Client: ${buf}`);
				});

				// Pipe all child process errors to current stderr
				child.stderr.on("data", function (buf) {
					process.stderr.write(`Client: ${buf}`);
				});

				child.on("error", function (err) {
					process.stdout.write(`Client: ${err}`);
				});
			})
			.catch(function (reason) {
				fail(`Unable to connect to server: (${reason})`);
			});
	} else {
		fail();
	}
}());