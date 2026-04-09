import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const formalCsvPath = path.join(workspaceRoot, "outputs", "formal_sciences_taxonomy_msc2020_core_adjacent.csv");
const outputDir = path.join(workspaceRoot, "data");
const outputPath = path.join(outputDir, "science_taxonomy.json");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(header.map((column, index) => [column, values[index] ?? ""]));
  });
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqueStrings(values) {
  return [...new Set((values || []).map(normalizeWhitespace).filter(Boolean))];
}

function makeKeywords(name) {
  return uniqueStrings(
    normalizeWhitespace(name)
      .split(/[\s,/()-]+/)
      .map((part) => part.toLowerCase())
      .filter((part) => part.length > 2),
  ).slice(0, 6);
}

function makeNode(name, summary, role = "field") {
  return {
    name: normalizeWhitespace(name),
    summary: normalizeWhitespace(summary),
    taxonomyRole: role,
    keywords: makeKeywords(name),
    children: [],
  };
}

function findOrCreateChild(parent, name, summary, role) {
  const normalized = normalizeWhitespace(name).toLowerCase();
  let child = parent.children.find((item) => item.name.toLowerCase() === normalized);
  if (!child) {
    child = makeNode(name, summary, role);
    parent.children.push(child);
  }
  return child;
}

function shouldSkipFormalRow(row) {
  const title = normalizeWhitespace(row.source_title);
  const subfield = normalizeWhitespace(row.subfield);
  const blockedPatterns = [
    /^General reference works\b/i,
    /^Introductory exposition\b/i,
    /^Research exposition\b/i,
    /^History of\b/i,
    /^Software,\s*source code\b/i,
    /^Proceedings,\s*conferences\b/i,
    /^Computational methods for problems pertaining to\b/i,
    /^Research data for problems pertaining to\b/i,
    /^External book reviews\b/i,
    /^Collections of\b/i,
    /^Conference proceedings\b/i,
    /^None of the above\b/i,
    /^Bibliographies for\b/i,
    /^Problem books\b/i,
    /^Dictionaries and other general reference works\b/i,
    /^Formularies\b/i,
    /^Lists of open problems\b/i,
  ];

  if (!title || !row.field) {
    return true;
  }

  if (normalizeWhitespace(row.field) === "General and overarching topics; collections") {
    return true;
  }

  if (blockedPatterns.some((pattern) => pattern.test(title)) || blockedPatterns.some((pattern) => pattern.test(subfield))) {
    return true;
  }

  return false;
}

function buildFormalDomain(rows) {
  const root = makeNode(
    "Formal sciences",
    "Abstract and symbolic disciplines concerned with mathematics, logic, computation, inference, information, systems, and formalized decision.",
    "domain",
  );

  for (const row of rows) {
    if (shouldSkipFormalRow(row)) {
      continue;
    }

    const branchName = normalizeWhitespace(row.formal_branch) || "Formal sciences";
    const fieldName = normalizeWhitespace(row.field);
    const subfieldName = normalizeWhitespace(row.subfield);
    const subSubfieldName = normalizeWhitespace(row.sub_subfield);

    const branch = findOrCreateChild(
      root,
      branchName,
      `${branchName} within the formal sciences.`,
      "field",
    );

    const field = findOrCreateChild(
      branch,
      fieldName,
      `${fieldName} as a major field within ${branchName}.`,
      "field",
    );

    if (!subfieldName || subfieldName === fieldName) {
      continue;
    }

    const subfield = findOrCreateChild(
      field,
      subfieldName,
      `${subfieldName} as a subfield of ${fieldName}.`,
      "subfield",
    );

    if (!subSubfieldName || subSubfieldName === subfieldName) {
      continue;
    }

    findOrCreateChild(
      subfield,
      subSubfieldName,
      `${subSubfieldName} as a specialty within ${subfieldName}.`,
      "specialty",
    );
  }

  return root;
}

function addChildrenByName(parent, name, children) {
  const node = parent.children.find((item) => item.name === name);
  if (!node) {
    return;
  }
  node.children = children;
}

function sortTree(node) {
  if (Array.isArray(node.children)) {
    node.children.sort((left, right) => left.name.localeCompare(right.name));
    node.children.forEach(sortTree);
  }
  return node;
}

const NATURAL_SCIENCES = makeNode(
  "Natural sciences",
  "Disciplines that study physical, chemical, biological, Earth, planetary, and environmental systems.",
  "domain",
);

NATURAL_SCIENCES.children = [
  makeNode("Physics", "The science of matter, energy, fields, motion, and fundamental interactions.", "field"),
  makeNode("Chemistry", "The science of substances, reactions, structure, and transformation of matter.", "field"),
  makeNode("Biological sciences", "The sciences of life, organisms, heredity, function, and evolution.", "field"),
  makeNode("Earth sciences", "The sciences of the solid Earth, oceans, atmosphere, and planetary processes.", "field"),
  makeNode("Astronomy and space sciences", "The sciences of celestial bodies, the universe, and space environments.", "field"),
  makeNode("Environmental sciences", "The sciences of ecosystems, environments, global change, and human-natural systems.", "field"),
];

addChildrenByName(NATURAL_SCIENCES, "Physics", [
  makeNode("Classical physics", "Macroscopic motion, forces, waves, fluids, and thermodynamics.", "subfield"),
  makeNode("Electromagnetism", "Electricity, magnetism, fields, optics, and radiation.", "subfield"),
  makeNode("Quantum physics", "Quantum states, measurement, and microscopic physical theory.", "subfield"),
  makeNode("Relativity and gravitation", "Spacetime, gravity, cosmological geometry, and relativistic theory.", "subfield"),
  makeNode("Condensed matter physics", "Solids, liquids, soft matter, electronic materials, and emergent phases.", "subfield"),
  makeNode("Statistical physics", "Large systems, ensembles, fluctuations, and nonequilibrium behavior.", "subfield"),
  makeNode("Atomic, molecular, and optical physics", "Atoms, molecules, light-matter interaction, and precision measurement.", "subfield"),
  makeNode("Nuclear physics", "Atomic nuclei, nuclear structure, reactions, and hadronic matter.", "subfield"),
  makeNode("Particle physics", "Fundamental particles, interactions, symmetries, and high-energy phenomena.", "subfield"),
  makeNode("Plasma physics", "Ionized matter, collective behavior, and plasma applications.", "subfield"),
  makeNode("Biophysics", "Physical principles applied to molecules, cells, tissues, and living systems.", "subfield"),
  makeNode("Geophysics", "Physical processes of Earth and its interior.", "subfield"),
]);

addChildrenByName(NATURAL_SCIENCES.children.find((node) => node.name === "Physics"), "Classical physics", [
  makeNode("Classical mechanics", "Kinematics, dynamics, Lagrangian and Hamiltonian formulations.", "specialty"),
  makeNode("Continuum mechanics", "Solids, fluids, elasticity, and continuum models.", "specialty"),
  makeNode("Acoustics", "Sound, vibration, and wave propagation.", "specialty"),
  makeNode("Thermodynamics", "Heat, work, energy, and equilibrium.", "specialty"),
  makeNode("Fluid mechanics", "Flow, turbulence, and transport in fluids.", "specialty"),
]);

addChildrenByName(NATURAL_SCIENCES.children.find((node) => node.name === "Physics"), "Electromagnetism", [
  makeNode("Electrostatics and magnetostatics", "Static fields and charges.", "specialty"),
  makeNode("Classical electrodynamics", "Time-varying fields, radiation, and Maxwell theory.", "specialty"),
  makeNode("Optics and photonics", "Light propagation, imaging, lasers, and optical devices.", "specialty"),
  makeNode("Nonlinear optics", "Nonlinear interaction of light and matter.", "specialty"),
  makeNode("Quantum optics", "Quantum states of light and photonic systems.", "specialty"),
]);

addChildrenByName(NATURAL_SCIENCES.children.find((node) => node.name === "Physics"), "Quantum physics", [
  makeNode("Quantum mechanics", "Foundations and mathematical structure of quantum theory.", "specialty"),
  makeNode("Quantum information science", "Computation, communication, and information in quantum systems.", "specialty"),
  makeNode("Quantum field theory", "Fields, particles, symmetries, and relativistic quantization.", "specialty"),
  makeNode("Quantum foundations", "Measurement, interpretation, nonlocality, and conceptual structure.", "specialty"),
]);

addChildrenByName(NATURAL_SCIENCES.children.find((node) => node.name === "Physics"), "Condensed matter physics", [
  makeNode("Solid-state physics", "Crystals, band structure, and electronic materials.", "specialty"),
  makeNode("Soft matter physics", "Polymers, colloids, foams, gels, and complex fluids.", "specialty"),
  makeNode("Materials physics", "Physical behavior of functional and structural materials.", "specialty"),
  makeNode("Low-temperature physics", "Superconductivity, superfluidity, and cryogenic states.", "specialty"),
  makeNode("Surface and interface physics", "Phenomena at boundaries and thin layers.", "specialty"),
]);

addChildrenByName(NATURAL_SCIENCES, "Chemistry", [
  makeNode("Analytical chemistry", "Measurement, detection, and chemical characterization.", "subfield"),
  makeNode("Inorganic chemistry", "Elements, coordination compounds, and non-carbon chemistry.", "subfield"),
  makeNode("Organic chemistry", "Carbon-based molecules, synthesis, and reactivity.", "subfield"),
  makeNode("Physical chemistry", "Chemical systems through thermodynamics, kinetics, and quantum theory.", "subfield"),
  makeNode("Biochemistry", "Chemical processes in living systems.", "subfield"),
  makeNode("Theoretical and computational chemistry", "Chemical modeling, simulation, and quantum chemistry.", "subfield"),
  makeNode("Materials chemistry", "Chemical design of materials, surfaces, and functional compounds.", "subfield"),
  makeNode("Chemical biology", "Chemical methods for biological systems.", "subfield"),
  makeNode("Environmental chemistry", "Chemical processes in natural and polluted environments.", "subfield"),
]);

addChildrenByName(NATURAL_SCIENCES.children.find((node) => node.name === "Chemistry"), "Analytical chemistry", [
  makeNode("Spectroscopy", "Chemical characterization through interaction with radiation.", "specialty"),
  makeNode("Chromatography and separation science", "Chemical separation and purification methods.", "specialty"),
  makeNode("Electroanalytical chemistry", "Measurement using electrochemical methods.", "specialty"),
  makeNode("Mass spectrometry", "Mass-based analysis of molecules and compounds.", "specialty"),
]);

addChildrenByName(NATURAL_SCIENCES.children.find((node) => node.name === "Chemistry"), "Organic chemistry", [
  makeNode("Synthetic organic chemistry", "Construction of organic molecules and pathways.", "specialty"),
  makeNode("Organometallic chemistry", "Metal-carbon compounds and catalytic systems.", "specialty"),
  makeNode("Medicinal chemistry", "Design and optimization of bioactive compounds.", "specialty"),
  makeNode("Polymer chemistry", "Macromolecules, plastics, and polymer synthesis.", "specialty"),
]);

addChildrenByName(NATURAL_SCIENCES, "Biological sciences", [
  makeNode("Molecular biology", "Molecular mechanisms of genes, proteins, and cells.", "subfield"),
  makeNode("Cell biology", "Cell structure, signaling, and function.", "subfield"),
  makeNode("Genetics and genomics", "Inheritance, genomes, variation, and gene regulation.", "subfield"),
  makeNode("Developmental biology", "Embryogenesis, morphogenesis, and life-cycle development.", "subfield"),
  makeNode("Evolutionary biology", "Evolution, adaptation, population change, and phylogeny.", "subfield"),
  makeNode("Ecology", "Organisms, populations, communities, and ecosystems.", "subfield"),
  makeNode("Physiology", "Function of organisms, organs, and systems.", "subfield"),
  makeNode("Neuroscience", "Nervous systems, neural circuits, and brain function.", "subfield"),
  makeNode("Microbiology", "Microorganisms including bacteria, archaea, fungi, and protists.", "subfield"),
  makeNode("Immunology", "Immune systems, defense, and immune regulation.", "subfield"),
  makeNode("Botany", "Plant life, structure, reproduction, and plant systems.", "subfield"),
  makeNode("Zoology", "Animal life, diversity, behavior, and physiology.", "subfield"),
  makeNode("Marine biology", "Life in marine environments.", "subfield"),
  makeNode("Systems biology", "Integrated biological systems and network behavior.", "subfield"),
]);

addChildrenByName(NATURAL_SCIENCES.children.find((node) => node.name === "Biological sciences"), "Genetics and genomics", [
  makeNode("Classical genetics", "Patterns of inheritance and transmission.", "specialty"),
  makeNode("Population genetics", "Genetic variation in populations.", "specialty"),
  makeNode("Genomics", "Whole-genome structure and function.", "specialty"),
  makeNode("Epigenetics", "Heritable regulation beyond DNA sequence.", "specialty"),
  makeNode("Transcriptomics and functional genomics", "Gene expression and genome-wide function.", "specialty"),
]);

addChildrenByName(NATURAL_SCIENCES.children.find((node) => node.name === "Biological sciences"), "Ecology", [
  makeNode("Population ecology", "Population dynamics and regulation.", "specialty"),
  makeNode("Community ecology", "Species interactions and community structure.", "specialty"),
  makeNode("Ecosystem ecology", "Energy flow, nutrient cycles, and ecosystems.", "specialty"),
  makeNode("Behavioral ecology", "Behavior in ecological and evolutionary context.", "specialty"),
  makeNode("Landscape ecology", "Spatial ecological patterns and processes.", "specialty"),
]);

addChildrenByName(NATURAL_SCIENCES, "Earth sciences", [
  makeNode("Geology", "Solid Earth materials, structures, and history.", "subfield"),
  makeNode("Geophysics", "Physical processes of Earth and its interior.", "subfield"),
  makeNode("Geochemistry", "Chemical composition and cycling of Earth materials.", "subfield"),
  makeNode("Hydrology", "Water systems above, below, and across Earth surfaces.", "subfield"),
  makeNode("Oceanography", "Physical, chemical, geological, and biological oceans.", "subfield"),
  makeNode("Atmospheric science", "Atmosphere, weather, climate, and atmospheric processes.", "subfield"),
  makeNode("Paleontology", "Fossils, ancient life, and deep-time biological history.", "subfield"),
  makeNode("Soil science", "Soil formation, classification, chemistry, and ecology.", "subfield"),
  makeNode("Volcanology", "Volcanoes, magma, and eruptive processes.", "subfield"),
  makeNode("Seismology", "Earthquakes, seismic waves, and Earth structure.", "subfield"),
]);

addChildrenByName(NATURAL_SCIENCES.children.find((node) => node.name === "Earth sciences"), "Geology", [
  makeNode("Mineralogy", "Minerals, crystal structures, and mineral systems.", "specialty"),
  makeNode("Petrology", "Origin and nature of rocks.", "specialty"),
  makeNode("Sedimentology and stratigraphy", "Sediments, layers, and depositional history.", "specialty"),
  makeNode("Structural geology", "Deformation, tectonics, and rock structure.", "specialty"),
  makeNode("Geomorphology", "Landforms and surface processes.", "specialty"),
]);

addChildrenByName(NATURAL_SCIENCES.children.find((node) => node.name === "Earth sciences"), "Atmospheric science", [
  makeNode("Meteorology", "Weather systems and atmospheric dynamics.", "specialty"),
  makeNode("Climatology", "Climate patterns, variability, and climate systems.", "specialty"),
  makeNode("Atmospheric chemistry", "Chemical processes in the atmosphere.", "specialty"),
  makeNode("Paleoclimatology", "Climate history reconstructed from proxies.", "specialty"),
]);

addChildrenByName(NATURAL_SCIENCES, "Astronomy and space sciences", [
  makeNode("Astrophysics", "Physical processes in stars, galaxies, and cosmic systems.", "subfield"),
  makeNode("Cosmology", "Origin, structure, and evolution of the universe.", "subfield"),
  makeNode("Planetary science", "Planets, moons, small bodies, and planetary systems.", "subfield"),
  makeNode("Heliophysics", "The Sun, solar wind, and solar-terrestrial interactions.", "subfield"),
  makeNode("Space physics", "Plasmas, radiation, and environments in space.", "subfield"),
  makeNode("Observational astronomy", "Data acquisition and interpretation across wavelengths.", "subfield"),
]);

addChildrenByName(NATURAL_SCIENCES.children.find((node) => node.name === "Astronomy and space sciences"), "Astrophysics", [
  makeNode("Stellar astrophysics", "Stars, stellar evolution, and stellar populations.", "specialty"),
  makeNode("Galactic astronomy", "Structure and dynamics of galaxies.", "specialty"),
  makeNode("Extragalactic astronomy", "Galaxies beyond the Milky Way and large-scale structure.", "specialty"),
  makeNode("High-energy astrophysics", "Extreme astrophysical processes and compact objects.", "specialty"),
]);

addChildrenByName(NATURAL_SCIENCES, "Environmental sciences", [
  makeNode("Conservation science", "Protection and stewardship of species and ecosystems.", "subfield"),
  makeNode("Environmental ecology", "Ecological processes in changing environments.", "subfield"),
  makeNode("Climate science", "Climate systems, change, impacts, and feedbacks.", "subfield"),
  makeNode("Biogeochemistry", "Chemical cycles linking life, Earth, and atmosphere.", "subfield"),
  makeNode("Environmental toxicology", "Effects of harmful substances on organisms and ecosystems.", "subfield"),
  makeNode("Sustainability science", "Integrated study of long-term human-environment systems.", "subfield"),
]);

const SOCIAL_SCIENCES = makeNode(
  "Social sciences",
  "Disciplines that study human behavior, social institutions, culture, governance, communication, and collective systems.",
  "domain",
);

SOCIAL_SCIENCES.children = [
  makeNode("Economics", "Production, exchange, allocation, incentives, and economic systems.", "field"),
  makeNode("Political science", "Power, institutions, states, governance, and political behavior.", "field"),
  makeNode("Sociology", "Social structure, institutions, culture, and patterned interaction.", "field"),
  makeNode("Anthropology", "Human cultures, societies, variation, and comparative life worlds.", "field"),
  makeNode("Psychology", "Mind, behavior, development, cognition, and mental processes.", "field"),
  makeNode("Human geography", "Spatial organization of societies, places, and human-environment relations.", "field"),
  makeNode("Linguistics", "Language structure, use, acquisition, and change.", "field"),
  makeNode("Archaeology", "Human past through material remains and contextual interpretation.", "field"),
  makeNode("Demography", "Population structure, fertility, mortality, migration, and population change.", "field"),
  makeNode("Communication and media studies", "Communication systems, media, discourse, and mediated publics.", "field"),
  makeNode("Education", "Learning, pedagogy, institutions, and educational systems.", "field"),
  makeNode("Criminology", "Crime, deviance, social control, and justice systems.", "field"),
];

addChildrenByName(SOCIAL_SCIENCES, "Economics", [
  makeNode("Microeconomics", "Decision-making by individuals, households, and firms.", "subfield"),
  makeNode("Macroeconomics", "Aggregate output, inflation, employment, and growth.", "subfield"),
  makeNode("Econometrics", "Statistical and causal methods for economic data.", "subfield"),
  makeNode("Behavioral economics", "Economic decision-making with psychological realism.", "subfield"),
  makeNode("Development economics", "Economic change, poverty, and development processes.", "subfield"),
  makeNode("Labor economics", "Work, wages, labor markets, and human capital.", "subfield"),
  makeNode("Public economics", "Taxation, public goods, and government policy.", "subfield"),
  makeNode("International economics", "Trade, finance, exchange, and cross-border flows.", "subfield"),
  makeNode("Monetary economics", "Money, banking, and monetary systems.", "subfield"),
  makeNode("Financial economics", "Asset pricing, markets, and financial structure.", "subfield"),
  makeNode("Industrial organization", "Market structure, competition, and firm behavior.", "subfield"),
  makeNode("Political economy", "Interactions of politics and economic systems.", "subfield"),
]);

addChildrenByName(SOCIAL_SCIENCES.children.find((node) => node.name === "Economics"), "Microeconomics", [
  makeNode("Consumer theory", "Choice, preferences, and demand.", "specialty"),
  makeNode("Producer theory", "Production, cost, and firm optimization.", "specialty"),
  makeNode("Game theory", "Strategic interaction among agents.", "specialty"),
  makeNode("Market design", "Rules and mechanisms for allocation and exchange.", "specialty"),
  makeNode("Information economics", "Asymmetric information, signaling, and incentives.", "specialty"),
]);

addChildrenByName(SOCIAL_SCIENCES.children.find((node) => node.name === "Economics"), "Macroeconomics", [
  makeNode("Business cycle theory", "Fluctuations in output, employment, and activity.", "specialty"),
  makeNode("Economic growth", "Long-run growth and productivity.", "specialty"),
  makeNode("Monetary macroeconomics", "Money, central banking, and macro stabilization.", "specialty"),
  makeNode("International macroeconomics", "Open-economy adjustment and global macro linkages.", "specialty"),
]);

addChildrenByName(SOCIAL_SCIENCES, "Political science", [
  makeNode("Political theory", "Normative and conceptual analysis of politics.", "subfield"),
  makeNode("Comparative politics", "Comparison of political systems and institutions.", "subfield"),
  makeNode("International relations", "States, conflict, diplomacy, and global order.", "subfield"),
  makeNode("Public administration", "Administration, bureaucracy, and public-sector organization.", "subfield"),
  makeNode("Public policy", "Policy formation, implementation, and evaluation.", "subfield"),
  makeNode("Political behavior", "Voting, opinion, participation, and political psychology.", "subfield"),
  makeNode("Political economy", "Politics and economic institutions together.", "subfield"),
  makeNode("Security studies", "Conflict, defense, violence, and strategic security.", "subfield"),
]);

addChildrenByName(SOCIAL_SCIENCES.children.find((node) => node.name === "Political science"), "International relations", [
  makeNode("International security", "War, deterrence, and strategic conflict.", "specialty"),
  makeNode("International political economy", "Trade, finance, and global governance.", "specialty"),
  makeNode("Foreign policy analysis", "State behavior and external decision-making.", "specialty"),
  makeNode("International organizations", "Institutions and global governance bodies.", "specialty"),
]);

addChildrenByName(SOCIAL_SCIENCES, "Sociology", [
  makeNode("Social theory", "General conceptual and theoretical sociology.", "subfield"),
  makeNode("Cultural sociology", "Culture, meaning, symbols, and social life.", "subfield"),
  makeNode("Political sociology", "Power, states, and political institutions in society.", "subfield"),
  makeNode("Economic sociology", "Markets, firms, and economic action as social phenomena.", "subfield"),
  makeNode("Sociology of education", "Schooling, inequality, and educational institutions.", "subfield"),
  makeNode("Sociology of religion", "Religious life, institutions, and social order.", "subfield"),
  makeNode("Sociology of family", "Families, kinship, and domestic organization.", "subfield"),
  makeNode("Medical sociology", "Health, illness, medicine, and social conditions.", "subfield"),
  makeNode("Urban sociology", "Cities, urban life, and metropolitan systems.", "subfield"),
  makeNode("Rural sociology", "Rural communities, agriculture, and spatial inequality.", "subfield"),
  makeNode("Stratification and inequality", "Class, status, race, gender, and inequality structures.", "subfield"),
  makeNode("Social movements", "Collective action, mobilization, and protest.", "subfield"),
]);

addChildrenByName(SOCIAL_SCIENCES, "Anthropology", [
  makeNode("Sociocultural anthropology", "Culture, society, and ethnographic comparison.", "subfield"),
  makeNode("Biological anthropology", "Human evolution, primates, and biological variation.", "subfield"),
  makeNode("Linguistic anthropology", "Language in cultural and social life.", "subfield"),
  makeNode("Archaeological anthropology", "Material culture and anthropological archaeology.", "subfield"),
  makeNode("Applied anthropology", "Anthropological work in practical and policy settings.", "subfield"),
]);

addChildrenByName(SOCIAL_SCIENCES, "Psychology", [
  makeNode("Cognitive psychology", "Perception, memory, reasoning, and cognition.", "subfield"),
  makeNode("Developmental psychology", "Psychological change across the lifespan.", "subfield"),
  makeNode("Social psychology", "Social cognition, influence, and interaction.", "subfield"),
  makeNode("Personality psychology", "Traits, character, and individual differences.", "subfield"),
  makeNode("Clinical psychology", "Mental health, assessment, and intervention.", "subfield"),
  makeNode("Counseling psychology", "Well-being, counseling, and applied support.", "subfield"),
  makeNode("Educational psychology", "Learning, development, and educational settings.", "subfield"),
  makeNode("Industrial and organizational psychology", "Work, organizations, and occupational behavior.", "subfield"),
  makeNode("Neuropsychology", "Brain-behavior relations and cognitive impairment.", "subfield"),
  makeNode("Quantitative psychology", "Measurement, psychometrics, and statistical models.", "subfield"),
]);

addChildrenByName(SOCIAL_SCIENCES, "Human geography", [
  makeNode("Economic geography", "Spatial organization of economic activity.", "subfield"),
  makeNode("Political geography", "Territory, borders, power, and spatial governance.", "subfield"),
  makeNode("Urban geography", "Cities, urban systems, and spatial inequality.", "subfield"),
  makeNode("Population geography", "Spatial population patterns and migration.", "subfield"),
  makeNode("Cultural geography", "Place, identity, meaning, and landscapes.", "subfield"),
  makeNode("Development geography", "Uneven development and spatial transformation.", "subfield"),
]);

addChildrenByName(SOCIAL_SCIENCES, "Linguistics", [
  makeNode("Phonetics and phonology", "Speech sounds and sound systems.", "subfield"),
  makeNode("Morphology", "Word structure and formation.", "subfield"),
  makeNode("Syntax", "Sentence structure and grammatical organization.", "subfield"),
  makeNode("Semantics", "Meaning in language.", "subfield"),
  makeNode("Pragmatics", "Language use in context.", "subfield"),
  makeNode("Sociolinguistics", "Language variation in social settings.", "subfield"),
  makeNode("Psycholinguistics", "Language processing and acquisition.", "subfield"),
  makeNode("Historical linguistics", "Language change through time.", "subfield"),
  makeNode("Computational linguistics", "Computational models of language.", "subfield"),
  makeNode("Applied linguistics", "Language teaching and real-world language problems.", "subfield"),
]);

addChildrenByName(SOCIAL_SCIENCES, "Archaeology", [
  makeNode("Prehistoric archaeology", "Societies before written records.", "subfield"),
  makeNode("Historical archaeology", "Archaeology of historically documented societies.", "subfield"),
  makeNode("Classical archaeology", "Ancient Mediterranean worlds.", "subfield"),
  makeNode("Landscape archaeology", "Spatial patterns and human activity across landscapes.", "subfield"),
  makeNode("Archaeometry", "Scientific methods in archaeological analysis.", "subfield"),
]);

addChildrenByName(SOCIAL_SCIENCES, "Demography", [
  makeNode("Fertility studies", "Birth patterns and reproductive behavior.", "subfield"),
  makeNode("Mortality studies", "Death patterns, survival, and life tables.", "subfield"),
  makeNode("Migration studies", "Population mobility and migration systems.", "subfield"),
  makeNode("Population forecasting", "Projection and modeling of population change.", "subfield"),
]);

addChildrenByName(SOCIAL_SCIENCES, "Communication and media studies", [
  makeNode("Interpersonal communication", "Face-to-face and relational communication.", "subfield"),
  makeNode("Journalism studies", "News institutions, practice, and public communication.", "subfield"),
  makeNode("Digital media studies", "Platforms, digital publics, and networked communication.", "subfield"),
  makeNode("Political communication", "Media, persuasion, and politics.", "subfield"),
  makeNode("Rhetoric", "Persuasion, discourse, and symbolic action.", "subfield"),
]);

addChildrenByName(SOCIAL_SCIENCES, "Education", [
  makeNode("Curriculum studies", "Knowledge organization and curriculum design.", "subfield"),
  makeNode("Higher education", "Universities, tertiary systems, and academic institutions.", "subfield"),
  makeNode("Comparative education", "Educational systems across societies.", "subfield"),
  makeNode("Educational policy", "Governance and policy in education systems.", "subfield"),
  makeNode("Assessment and evaluation", "Measurement and evaluation in education.", "subfield"),
  makeNode("Special education", "Learning support for diverse needs.", "subfield"),
]);

addChildrenByName(SOCIAL_SCIENCES, "Criminology", [
  makeNode("Crime theory", "Explanatory theories of crime and deviance.", "subfield"),
  makeNode("Victimology", "Victims, victimization, and harm.", "subfield"),
  makeNode("Penology", "Punishment, imprisonment, and correctional systems.", "subfield"),
  makeNode("Policing studies", "Police institutions, strategy, and legitimacy.", "subfield"),
  makeNode("Juvenile justice", "Youth offending and justice systems for minors.", "subfield"),
]);

async function main() {
  const formalCsv = await readFile(formalCsvPath, "utf8");
  const formalRows = parseCsv(formalCsv);

  const roots = [
    sortTree(buildFormalDomain(formalRows)),
    sortTree(NATURAL_SCIENCES),
    sortTree(SOCIAL_SCIENCES),
  ];

  const payload = {
    generated_at: new Date().toISOString(),
    roots,
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
