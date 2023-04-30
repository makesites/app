module.exports = function(grunt) {
	var babel = require('rollup-plugin-babel');
	var minify = require('rollup-plugin-babel-minify');

	var pkg = require("./package.json");

	var date = (new Date()).toUTCString();
	var banner = `
/**
 * @name <%= pkg.name %>
 * <%= pkg.description %>
 *
 * Version: <%= pkg.version %> (<%= grunt.template.today("yyyy") %>)
 * Source: <%= pkg.repository %>
 *
 * @author <%= pkg.author %>
 * Distributed by [Makesites.org](http://makesites.org)
 *
 * @license Released under the <%= pkg.license %> licenses
 */
`;
	var banner_min = "/*"+ pkg.name +" v"+ pkg.version +" ("+ date +") - licensed: "+ pkg.license +" - makesites.org */";

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		rollup: {
			main: {
				options: {
					minified: true,
					banner: banner,
				},
				files: {
					'build/app.js': ['lib/main.js']
				}
			},
			legacy: {
				options: {
					//debug: true,
					plugins: [
						babel({
							presets: ['@babel/env'],
							minified: true,
							//exclude: './node_modules/**'
						}),
						minify({
							comments: false,
							banner: banner_min,
							bannerNewLine: true,
							sourceMap: true
						})
					]
				},
				files: {
					'build/app.legacy.js': ['lib/main.js']
				}
			}
		},
		terser: {
			options: {
				mangle: true,
				output: {
					comments: "/@name|@author|@license/"
				},
				sourceMap: {
					filename: "build/app.min.js.map",
					url: "app.min.js.map"
				}
			},
			dist: {
				files: {
					'build/app.min.js': ['build/app.js']
				}
			}
		},
	});

	grunt.loadNpmTasks('grunt-rollup');
	grunt.loadNpmTasks('grunt-terser');

	grunt.registerTask('default', ['rollup:main', 'terser', 'rollup:legacy']);

};
