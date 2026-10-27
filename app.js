let ingredients = [];

let recipes = [];

let mealPlan = [];



async function api(url, options = {}) {

    const response = await fetch(url, {

        ...options,

        headers: {

            "Content-Type": "application/json",

            ...(options.headers || {})

        }

    });


    if (!response.ok) {

        const error = await response.text();

        throw new Error(error || "Request failed");

    }


    return response.json();

}



/* =========================
   LOAD RECIPES
========================= */

async function loadRecipes() {

    try {

        recipes = await api("/api/recipes");

        renderRecipes();

    } catch (error) {

        console.error(error);

        document.getElementById("recipes").innerHTML = `

            <div class="panel empty">

                Unable to load recipes.

                Make sure the backend is running.

            </div>

        `;

    }

}



/* =========================
   INGREDIENTS
========================= */

function normalizeIngredient(value) {

    return value
        .trim()
        .toLowerCase();

}



function renderIngredients() {

    const container =
        document.getElementById("ingredients");


    if (!ingredients.length) {

        container.innerHTML = `

            <div class="empty">

                No ingredients added yet.

            </div>

        `;

        return;

    }


    container.innerHTML =
        ingredients.map((ingredient, index) => `

            <span class="ingredient">

                ${ingredient}

                <button
                    onclick="removeIngredient(${index})">

                    ×

                </button>

            </span>

        `).join("");

}



async function addIngredient() {

    const input =
        document.getElementById("newIngredient");


    const value =
        normalizeIngredient(input.value);


    if (!value) {

        return;

    }


    if (!ingredients.includes(value)) {

        ingredients.push(value);

    }


    input.value = "";

    renderIngredients();

    await updateRecommendations();

}



async function removeIngredient(index) {

    ingredients.splice(index, 1);

    renderIngredients();

    await updateRecommendations();

}



/* =========================
   IMAGE RECOGNITION
========================= */

async function recognizeImage(file) {

    const status =
        document.getElementById("scanStatus");


    if (!file) {

        return;

    }


    status.textContent =
        "Analyzing your ingredients...";


    try {

        const formData =
            new FormData();

        formData.append("image", file);


        const response =
            await fetch("/api/recognize", {

                method: "POST",

                body: formData

            });


        if (!response.ok) {

            throw new Error(
                "Image recognition failed"
            );

        }


        const data =
            await response.json();


        ingredients =
            data.ingredients || [];


        renderIngredients();

        await updateRecommendations();


        status.textContent =
            `${ingredients.length} ingredients detected.`;

    } catch (error) {

        console.error(error);

        status.textContent =
            "Could not recognize the image.";

    }

}



/* =========================
   RECIPE MATCHING
========================= */

async function updateRecommendations() {

    const diet =
        document.getElementById("diet").value;


    const avoid =
        document.getElementById("avoid").value;


    const container =
        document.getElementById("recipes");


    container.innerHTML = `

        <div class="panel empty">

            Finding the best recipes...

        </div>

    `;


    try {

        const result =
            await api("/api/match", {

                method: "POST",

                body: JSON.stringify({

                    ingredients,

                    diet,

                    avoid

                })

            });


        renderRecipes(result);

    } catch (error) {

        console.error(error);

        container.innerHTML = `

            <div class="panel empty">

                Could not calculate recipe matches.

            </div>

        `;

    }

}



/* =========================
   DISPLAY RECIPES
========================= */

function renderRecipes(recipeList = recipes) {

    const container =
        document.getElementById("recipes");


    if (!recipeList.length) {

        container.innerHTML = `

            <div class="panel empty">

                No recipes match your current ingredients
                and restrictions.

            </div>

        `;

        return;

    }


    container.innerHTML =
        recipeList.map(recipe => `

            <div class="panel recipe">

                <div class="score">

                    ${recipe.score}% match

                </div>


                <h3>

                    ${recipe.name}

                </h3>


                <div>

                    ${recipe.diet.map(diet => `

                        <span class="diet-tag">

                            ${diet}

                        </span>

                    `).join("")}

                </div>


                <p class="missing">

                    <strong>
                        Missing:
                    </strong>

                    ${
                        recipe.missing.length
                        ? recipe.missing.join(", ")
                        : "Nothing. You have everything!"
                    }

                </p>


                <div class="recipe-buttons">

                    <button
                        class="btn secondary"
                        onclick="showRecipe('${escapeString(recipe.name)}')">

                        View Recipe

                    </button>


                    <button
                        class="btn primary"
                        onclick="addToPlan('${escapeString(recipe.name)}')">

                        Add to Plan

                    </button>

                </div>

            </div>

        `).join("");

}



function escapeString(value) {

    return value
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");

}



/* =========================
   RECIPE MODAL
========================= */

function showRecipe(name) {

    const recipe =
        recipes.find(
            item => item.name === name
        );


    if (!recipe) {

        return;

    }


    document.getElementById("modalTitle")
        .textContent = recipe.name;


    document.getElementById("modalBody")
        .innerHTML = `

            <p>

                ${recipe.instructions}

            </p>


            <p>

                <strong>
                    Ingredients:
                </strong>

                ${recipe.ingredients.join(", ")}

            </p>

        `;


    document.getElementById("preview")
        .style.display = "flex";

}



function closeModal() {

    document.getElementById("preview")
        .style.display = "none";

}



/* =========================
   MEAL PLAN
========================= */

function addToPlan(name) {

    if (!mealPlan.includes(name)) {

        mealPlan.push(name);

    }


    renderPlan();

}



function removePlan(index) {

    mealPlan.splice(index, 1);

    renderPlan();

}



function renderPlan() {

    const container =
        document.getElementById("plan");


    if (!mealPlan.length) {

        container.className = "empty";

        container.textContent =
            "No meals added yet. Add a recipe above to start planning.";

        return;

    }


    container.className = "";


    container.innerHTML =
        mealPlan.map((meal, index) => `

            <div class="plan-item">

                <span>

                    ${meal}

                </span>


                <button
                    onclick="removePlan(${index})">

                    Remove

                </button>

            </div>

        `).join("");

}



/* =========================
   NAVIGATION
========================= */

function scrollToSection(id) {

    document
        .getElementById(id)
        .scrollIntoView({
            behavior: "smooth"
        });

}



/* =========================
   EVENT LISTENERS
========================= */

document
    .getElementById("photo")
    .addEventListener("change", event => {

        const file =
            event.target.files[0];

        recognizeImage(file);

    });



document
    .getElementById("diet")
    .addEventListener(
        "change",
        updateRecommendations
    );



document
    .getElementById("avoid")
    .addEventListener(
        "change",
        updateRecommendations
    );



document
    .getElementById("newIngredient")
    .addEventListener("keydown", event => {

        if (event.key === "Enter") {

            addIngredient();

        }

    });



/* =========================
   START APPLICATION
========================= */

loadRecipes();

renderIngredients();

renderPlan();