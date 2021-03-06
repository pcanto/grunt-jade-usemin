'use strict';

var grunt = require('grunt');

var fileCmp = function (test, fileName) {
    var actual = grunt.file.read('./test/compiled/' + fileName);
    var expected = grunt.file.read('./test/expected/' + fileName);
    test.equal(actual.trim(), expected.trim(), 'files should be equal');
};

exports.jadeUsemin = {
    setUp: function (done) {
        // setup here if necessary
        done();
    },
    basic: function (test) {
        test.expect(1);

        var basic = 'basic.min.js';
        fileCmp(test, basic);

        test.done();
    },
    multiple: function (test) {
        test.expect(2);

        var multipleJs = 'multiple.min.js';
        fileCmp(test, multipleJs);

        var multipleCss = 'multiple.min.css';
        fileCmp(test, multipleCss);

        test.done();
    },
    replacePath: function (test) {
        test.expect(1);

        var replacePath = 'replacePath.min.js';
        fileCmp(test, replacePath);

        test.done();
    }
};
