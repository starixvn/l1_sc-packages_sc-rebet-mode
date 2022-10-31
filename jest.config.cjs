module.exports = async () => {
    return {
        rootDir: "./",
        verbose: true,
        transform: {
            "^.+\\.js?$": "babel-jest",
        },
        transformIgnorePatterns: [
            "node_modules/(?!(jest-auto-fixture)/)",
        ],
        testEnvironment: "node",
        testResultsProcessor: "jest-sonar-reporter",
        setupFilesAfterEnv: ["jest-extended"],
        reporters: ["default", ["jest-html-reporters", { publicPath: "./reports", filename: "report.html" }]],
    };
};
