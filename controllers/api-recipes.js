const Recipe = require("../models/recipe");

exports.getRecipes = async (req, res, next) => {
    try {
        const recipes = await Recipe.find({type: "public"})
            .populate("author", "username userImage")

        res.status(200).json({recipes: recipes});
    } catch (err) {
        res.status(500).json({error: err});
    }
}