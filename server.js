import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();


const app = express();

const PORT =
    process.env.PORT || 3000;



/* =========================
   MIDDLEWARE
========================= */

app.use(
    express.json()
);


app.use(
    express.static("public")
);



/* =========================
   OPENAI
========================= */

const openai =
    new OpenAI({

        apiKey:
            process.env.OPENAI_API_KEY

    });



/* =========================
   SUPABASE
========================= */

const supabase =
    createClient(

        process.env.SUPABASE_URL,

        process.env.SUPABASE_SECRET_KEY

    );



/* =========================
   IMAGE UPLOAD
========================= */

const upload =
    multer({

        storage:
            multer.memoryStorage(),

        limits: {

            fileSize:
                8 * 1024 * 1024

        }

    });



/* =========================
   HELPERS
========================= */

function normalize(value) {

    return value
        .trim()
        .toLowerCase();

}



function calculateMatches(
    recipes,
    ingredients,
    diet,
    avoid
) {

    const available =
        new Set(
            ingredients.map(normalize)
        );


    let results =
        recipes.filter(recipe => {

            if (
                diet !== "all" &&
                !recipe.diet.includes(diet)
            ) {

                return false;

            }


            if (
                avoid === "peanut" &&
                recipe.ingredients.includes("peanut")
            ) {

                return false;

            }


            if (
                avoid === "dairy" &&
                recipe.ingredients.some(
                    ingredient =>
                        ["milk", "cheese"]
                        .includes(ingredient)
                )
            ) {

                return false;

            }


            return true;

        });


    results =
        results.map(recipe => {

            const required =
                recipe.ingredients
                    .map(normalize);


            const matched =
                required.filter(
                    ingredient =>
                        available.has(ingredient)
                );


            const missing =
                required.filter(
                    ingredient =>
                        !available.has(ingredient)
                );


            const score =
                Math.round(
                    matched.length /
                    required.length *
                    100
                );


            return {

                ...recipe,

                score,

                missing

            };

        });


    results.sort((a, b) => {

        if (b.score !== a.score) {

            return b.score - a.score;

        }


        return (
            a.missing.length -
            b.missing.length
        );

    });


    return results;

}



/* =========================
   GET RECIPES
========================= */

app.get(
    "/api/recipes",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from("recipes")
                .select("*")
                .order("name");


            if (error) {

                throw error;

            }


            res.json(data);

        } catch (error) {

            console.error(error);

            res.status(500).json({

                error:
                    "Could not load recipes."

            });

        }

    }
);



/* =========================
   MATCH RECIPES
========================= */

app.post(
    "/api/match",
    async (req, res) => {

        try {

            const {

                ingredients = [],

                diet = "all",

                avoid = "none"

            } = req.body;


            const {
                data: recipes,
                error
            } = await supabase
                .from("recipes")
                .select("*");


            if (error) {

                throw error;

            }


            const results =
                calculateMatches(
                    recipes,
                    ingredients,
                    diet,
                    avoid
                );


            res.json(results);

        } catch (error) {

            console.error(error);

            res.status(500).json({

                error:
                    "Could not calculate recipe matches."

            });

        }

    }
);



/* =========================
   IMAGE RECOGNITION
========================= */

app.post(
    "/api/recognize",
    upload.single("image"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({

                    error:
                        "No image uploaded."

                });

            }


            const allowedTypes = [

                "image/jpeg",

                "image/png",

                "image/webp",

                "image/gif"

            ];


            if (
                !allowedTypes
                    .includes(req.file.mimetype)
            ) {

                return res.status(400).json({

                    error:
                        "Unsupported image type."

                });

            }


            const base64 =
                req.file.buffer
                    .toString("base64");


            const dataUrl =
                `data:${req.file.mimetype};base64,${base64}`;


            const response =
                await openai.responses.create({

                    model:
                        process.env.OPENAI_VISION_MODEL ||
                        "gpt-5.5",

                    input: [

                        {

                            role: "user",

                            content: [

                                {

                                    type:
                                        "input_text",

                                    text:
                                        [
                                            "Identify food ingredients visible in this image.",
                                            "Return ONLY valid JSON.",
                                            'Use exactly this structure: {"ingredients":["egg","tomato"]}.',
                                            "Use common English ingredient names.",
                                            "Do not include dishes, brands, packaging, utensils, or non-food objects.",
                                            "If uncertain, omit the item rather than guessing."
                                        ].join(" ")

                                },

                                {

                                    type:
                                        "input_image",

                                    image_url:
                                        dataUrl,

                                    detail:
                                        "high"

                                }

                            ]

                        }

                    ]

                });


            const output =
                response.output_text;


            let parsed;


            try {

                parsed =
                    JSON.parse(output);

            } catch {

                throw new Error(
                    "AI returned invalid JSON."
                );

            }


            const ingredients =
                Array.isArray(
                    parsed.ingredients
                )

                    ? parsed.ingredients
                        .map(normalize)
                        .filter(Boolean)

                    : [];


            const uniqueIngredients =
                [...new Set(ingredients)];


            res.json({

                ingredients:
                    uniqueIngredients

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                error:
                    "Image recognition failed."

            });

        }

    }
);



/* =========================
   START SERVER
========================= */

app.listen(
    PORT,
    () => {

        console.log(
            `MealMatch running at http://localhost:${PORT}`
        );

    }
);