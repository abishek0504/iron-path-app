module.exports = function(api) {
    api.cache(true);
    return {
      presets: ['babel-preset-expo'],
      // plugins: ["nativewind/babel"],  <-- Make sure this is commented out or removed!
    };
  };