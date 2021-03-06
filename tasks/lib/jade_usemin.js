/**
 * Created by Gilad Peleg on 25/11/13.
 */
'use strict';

var path = require('path');
var _ = require('lodash');

// set up relevant regex for jade find
var regex = {
    buildRegex: /<!-- build/,
    buildExtractRegex: /build:(\w+)\s+((\w*[\/._-]*)+)/,
    endBuildRegex: /<!-- endbuild/,
    jsSourceRegex: /src=['"]((\w*[\/._-]*)+)['"]/,
    cssSourceRegex: /href=['"]((\w*[\/._-]*)+)['"]/
};

var getSrcRegex = function (type) {
    if (type === 'js') {
        return regex.jsSourceRegex;
    } else if (type === 'css') {
        return regex.cssSourceRegex;
    }
    return null;
};

exports.task = function (grunt) {
    var exports = {
        options: {}
    };

    //contains all of our targets
    exports.extractedTargets = {};

    /**
     * Add Concat file target
     * @param {Object} concat
     * @param src
     * @param dest
     */
    exports.addConcatFileTarget = function (concat, src, dest) {
        concat.files.push({
            src: src,
            dest: dest
        });
    };

    exports.addTaskTarget = function (task, target) {
        var targetObj = {};
        targetObj[target] = target;
        task.files.push(targetObj);
    };

    /**
     * Process the extracted targets
     * @param parameters
     * @param {Object} parameters.extractedTargets
     * @param parameters.concat
     * @param parameters.uglify
     * @returns {number} totalFiles Total files processed as source files
     */
    exports.processTasks = function (parameters) {
        var extractedTargets, concat, uglify, cssmin, totalFiles;

        extractedTargets = parameters.extractedTargets;
        concat = parameters.concat;
        uglify = exports.options.uglify ? parameters.uglify : null;

        cssmin = parameters.cssmin;
        totalFiles = 0;

        _.each(extractedTargets, function (item, target) {
            exports.addConcatFileTarget(concat, item.src, target);
            grunt.log.oklns('Target ' + target + ' contains ' + item.src.length + ' files.');
            totalFiles += item.src.length;

            if (item.type === 'js' && uglify) {
                exports.addTaskTarget(uglify, target);
            } else if (item.type === 'css') {
                exports.addTaskTarget(cssmin, target);
            }
        });

        return totalFiles;
    };

    exports.insertSrcIntoTargetObj = function (tempExtraction, target, src) {
        grunt.verbose.writelns('Adding src file ' + src);
        tempExtraction[target].src.push(src);
    };

    exports.extractTargetsFromJade = function (location, extractedTargets) {
        //current temp file
        var srcRegex;
        var insideBuild = false;
        var target = null;
        var extracted = [];
        var type = null;
        var tempExtraction = {};
        var prefix = exports.options.prefix;
        var file = grunt.file.read(location).split('\n');

        _.each(file, function (line, lineIndex) {
            //if still scanning for build:<type>
            if (!insideBuild) {
                //look for pattern build:<type>
                if (line.match(regex.buildRegex)) {
                    //replace path from options.replacePath
                    _.each(exports.options.replacePath, function (path, key) {
                        line = line.replace(key, path);
                    });

                    extracted = line.match(regex.buildExtractRegex);
                    type = extracted[1];
                    target = extracted[2];

                    //if unrecognized build type
                    if (type !== 'css' && type !== 'js') {
                        grunt.log.error('Unsupported build type: ' + type + ' in line number:' + lineIndex);
                        return;
                    } else if (!target) {
                        grunt.log.warn('Target not found in line:' + line);
                        return;
                    }

                    grunt.verbose.writelns('Found build:<type> pattern in line:', lineIndex);
                    //default empty target
                    tempExtraction[target] = {
                        type: type,
                        src: []
                    };

                    insideBuild = true;
                }
            }
            //got to end of build: <!-- endbuild -->
            else if (line.match(regex.endBuildRegex) && type && target) {
                grunt.verbose.writelns('Found endbuild pattern in line ', lineIndex);
                extractedTargets[target] = {};

                _.merge(extractedTargets[target], tempExtraction[target]);

                grunt.log.oklns('Finished with target block:', target);
                type = target = insideBuild = null;
            }
            //we are inside a build:<type> block
            else {
                //replace path from options.replacePath
                _.each(exports.options.replacePath, function (path, key) {
                    line = line.replace(key, path);
                });

                srcRegex = getSrcRegex(type);
                var src = line.match(srcRegex);
                if (src && src[1]) {
                    src = src[1];
                    if (src.charAt(0) === '/') {
                        src = src.substr(1);
                    }

                    //if prefix option exists than concat it
                    if (prefix) {
                        src = prefix + src;
                    }

                    //if path actually exists
                    if (grunt.file.exists(src)) {
                        exports.insertSrcIntoTargetObj(tempExtraction, target, src);
                    } else {
                        //attempt to resolve path relative to location (where jade file is)
                        var locationPath = path.dirname(location);
                        var newSrcPath = path.resolve(locationPath, src);
                        grunt.verbose.writelns('Src file ' + src + " wasn't found. Looking for it relative to jade file");
                        if (grunt.file.exists(newSrcPath)) {
                            exports.insertSrcIntoTargetObj(tempExtraction, target, newSrcPath);
                        }
                        //src file wasn't found
                        else {
                            grunt.log.warn("Found script src that doesn't exist: " + src);
                        }
                    }
                }
            }
        });

        if (insideBuild) {
            grunt.fatal("Couldn't find `endbuild` in file: " + location + ", target: " + target);
        }
    };

    return exports;
};
