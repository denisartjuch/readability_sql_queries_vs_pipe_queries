const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    mode: "production",
    target: "web",
    devtool: "source-map",

    entry: "./typescript/experiment_configuration.ts",

    resolve: {
        extensions: [".ts", ".js"],

        extensionAlias: {
            ".js": [".ts", ".js"],
        },
    },

    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: "ts-loader",
                    options: {
                        configFile: "tsconfig.json",
                        transpileOnly: true,
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },

    optimization: {
        splitChunks: false,
        runtimeChunk: false,
    },

    plugins: [
        new CopyWebpackPlugin({
            patterns: [{ from: "index.html", to: "index.html" }],
        }),
    ],

    output: {
        filename: "experiment_configuration.js",
        path: path.resolve(__dirname, "dist"),
        clean: true,
        publicPath: "",
    },
};
