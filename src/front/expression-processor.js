const R = require('ramda');

const isObject = obj => {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}

const deepMapObjIndexed = (fn, obj) => {
    const mapValues = (current, parentKey = '', parentObj = null) => {
        // console.log(' -> ', parentKey, current, Array.isArray(current), R.is(Object, current));
        if (Array.isArray(current)) {
            // Apply recursively to each item in an array
            return current.map((item, index) => mapValues(item, index, current));
        } else if (isObject(current)) {
            // Apply the function to each value for objects
            return R.reduce((acc, key) => {
                acc[key] = mapValues(current[key], key, current);
                return acc;
            }, {}, R.keys(current));
        } else {
            // Apply the provided function to the value
            return fn(current, parentKey, parentObj);
        }
    };

    return mapValues(obj);
};


function processExpressions(obj) {
    return deepMapObjIndexed((val, key, parentObj) => {
        // console.log(key);
        if (key === '_expressionResult') {
            const fn = new Function('obj', `return JSON.stringify(${val})`);
            return fn(parentObj);
        } else {
            return val;
        }
    }, obj);
}

module.exports = {
    processExpressions
}