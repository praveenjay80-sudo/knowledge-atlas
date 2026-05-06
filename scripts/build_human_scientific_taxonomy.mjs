import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const outputPath = path.join(workspaceRoot, "data", "human_scientific_knowledge_taxonomy.json");

const WORKS = {
  mathematics: [
    work("Euclid", "Elements", "c. 300 BCE", "Foundational axiomatic model for mathematics."),
    work("David Hilbert", "Grundlagen der Geometrie", "1899", "Modern axiomatic method and structural rigor."),
    work("Nicolas Bourbaki", "Elements of Mathematics", "1939-", "Influential structural synthesis of modern mathematics."),
  ],
  logic: [
    work("Aristotle", "Organon", "4th c. BCE", "Classical foundation of formal reasoning."),
    work("Gottlob Frege", "Begriffsschrift", "1879", "Beginning of modern symbolic logic."),
    work("Kurt Godel", "On Formally Undecidable Propositions", "1931", "Landmark result on formal systems."),
  ],
  computerScience: [
    work("Alan Turing", "On Computable Numbers", "1936", "Foundational model of computation."),
    work("Claude Shannon", "A Mathematical Theory of Communication", "1948", "Foundation of information theory."),
    work("Donald Knuth", "The Art of Computer Programming", "1968-", "Canonical algorithmic reference."),
  ],
  physics: [
    work("Isaac Newton", "Philosophiae Naturalis Principia Mathematica", "1687", "Classical mechanics and mathematical physics."),
    work("James Clerk Maxwell", "A Dynamical Theory of the Electromagnetic Field", "1865", "Unified electromagnetism."),
    work("Albert Einstein", "The Foundation of the General Theory of Relativity", "1916", "Modern relativistic gravitation."),
  ],
  chemistry: [
    work("Antoine Lavoisier", "Traite elementaire de chimie", "1789", "Modern chemical nomenclature and conservation framework."),
    work("Dmitri Mendeleev", "The Relation between the Properties and Atomic Weights of the Elements", "1869", "Periodic classification."),
    work("Linus Pauling", "The Nature of the Chemical Bond", "1939", "Modern structural bonding theory."),
  ],
  biology: [
    work("Charles Darwin", "On the Origin of Species", "1859", "Foundation of evolutionary biology."),
    work("Gregor Mendel", "Experiments on Plant Hybridization", "1866", "Foundation of genetics."),
    work("Watson and Crick", "Molecular Structure of Nucleic Acids", "1953", "DNA structure and molecular biology."),
  ],
  earth: [
    work("Charles Lyell", "Principles of Geology", "1830-1833", "Uniformitarian geology."),
    work("Alfred Wegener", "The Origin of Continents and Oceans", "1915", "Continental drift precursor to plate tectonics."),
    work("Rachel Carson", "Silent Spring", "1962", "Modern environmental science and toxicology awareness."),
  ],
  medicine: [
    work("Hippocrates", "Hippocratic Corpus", "5th-4th c. BCE", "Early clinical observation tradition."),
    work("William Harvey", "De Motu Cordis", "1628", "Modern physiology of circulation."),
    work("Louis Pasteur", "Germ Theory papers", "1860s", "Microbial theory of disease."),
  ],
  engineering: [
    work("Vitruvius", "De architectura", "c. 30-15 BCE", "Classical engineering and architecture synthesis."),
    work("Sadi Carnot", "Reflections on the Motive Power of Fire", "1824", "Foundation of thermodynamics for engineering."),
    work("Claude Shannon", "A Mathematical Theory of Communication", "1948", "Core for electrical and information engineering."),
  ],
  social: [
    work("Adam Smith", "An Inquiry into the Nature and Causes of the Wealth of Nations", "1776", "Foundation of classical economics."),
    work("Emile Durkheim", "The Rules of Sociological Method", "1895", "Foundation of sociology as a methodical science."),
    work("Max Weber", "Economy and Society", "1922", "Foundational social theory and comparative sociology."),
  ],
  psychology: [
    work("Wilhelm Wundt", "Principles of Physiological Psychology", "1874", "Experimental psychology."),
    work("William James", "The Principles of Psychology", "1890", "Foundational psychology synthesis."),
    work("Ulric Neisser", "Cognitive Psychology", "1967", "Modern cognitive psychology."),
  ],
  linguistics: [
    work("Ferdinand de Saussure", "Course in General Linguistics", "1916", "Structural linguistics."),
    work("Noam Chomsky", "Syntactic Structures", "1957", "Generative linguistics."),
    work("William Labov", "The Social Stratification of English in New York City", "1966", "Sociolinguistics."),
  ],
  agriculture: [
    work("Justus von Liebig", "Organic Chemistry in its Applications to Agriculture and Physiology", "1840", "Agricultural chemistry."),
    work("Norman Borlaug", "Green Revolution wheat breeding papers", "1960s", "Modern high-yield crop science."),
    work("R. A. Fisher", "The Design of Experiments", "1935", "Experimental design for agricultural science."),
  ],
  methods: [
    work("Francis Bacon", "Novum Organum", "1620", "Empirical scientific method."),
    work("R. A. Fisher", "Statistical Methods for Research Workers", "1925", "Modern statistical inference."),
    work("Thomas Kuhn", "The Structure of Scientific Revolutions", "1962", "Modern science studies."),
  ],
};

const TAXONOMY = [
  domain("Formal sciences", "Abstract, symbolic, mathematical, computational, and logical systems of knowledge.", [
    field("Mathematics", "Study of quantity, structure, space, change, pattern, and abstraction.", "mathematics", [
      sub("Algebra", ["Elementary algebra", "Linear algebra", "Abstract algebra", "Commutative algebra", "Homological algebra", "Representation theory", "Category-theoretic algebra", "Universal algebra"]),
      sub("Number theory", ["Elementary number theory", "Analytic number theory", "Algebraic number theory", "Arithmetic geometry", "Diophantine equations", "Modular forms", "Transcendental number theory"]),
      sub("Geometry", ["Euclidean geometry", "Differential geometry", "Algebraic geometry", "Symplectic geometry", "Riemannian geometry", "Discrete geometry", "Convex geometry", "Geometric topology"]),
      sub("Topology", ["Point-set topology", "Algebraic topology", "Differential topology", "Low-dimensional topology", "Homotopy theory", "Knot theory", "Topological data analysis"]),
      sub("Analysis", ["Real analysis", "Complex analysis", "Functional analysis", "Harmonic analysis", "Nonlinear analysis", "Measure theory", "Operator theory", "Microlocal analysis"]),
      sub("Probability and statistics", ["Probability theory", "Stochastic processes", "Mathematical statistics", "Bayesian statistics", "Statistical learning theory", "Extreme value theory", "Causal inference"]),
      sub("Discrete mathematics", ["Combinatorics", "Graph theory", "Matroid theory", "Design theory", "Coding theory", "Enumerative combinatorics", "Extremal combinatorics"]),
      sub("Applied mathematics", ["Dynamical systems", "Numerical analysis", "Optimization", "Control theory", "Mathematical biology", "Mathematical finance", "Inverse problems", "Perturbation methods"]),
    ]),
    field("Logic and foundations", "Formal reasoning, proof, semantics, computability, and foundations of mathematics.", "logic", [
      sub("Mathematical logic", ["Proof theory", "Model theory", "Set theory", "Recursion theory", "Reverse mathematics", "Constructive mathematics"]),
      sub("Philosophical logic", ["Modal logic", "Temporal logic", "Deontic logic", "Relevance logic", "Many-valued logic", "Paraconsistent logic"]),
      sub("Foundations of mathematics", ["Axiomatic set theory", "Type theory", "Category foundations", "Formalism", "Logicism", "Intuitionism"]),
      sub("Automated reasoning", ["Theorem proving", "SAT solving", "SMT solving", "Proof assistants", "Logic programming"]),
    ]),
    field("Computer science", "Theory, construction, and analysis of computation and information-processing systems.", "computerScience", [
      sub("Theory of computation", ["Automata theory", "Computability theory", "Complexity theory", "Formal languages", "Parameterized complexity", "Quantum complexity"]),
      sub("Algorithms and data structures", ["Algorithm design", "Analysis of algorithms", "Approximation algorithms", "Randomized algorithms", "Online algorithms", "Data structures", "String algorithms"]),
      sub("Programming languages", ["Type systems", "Compiler theory", "Programming semantics", "Runtime systems", "Program analysis", "Formal verification"]),
      sub("Artificial intelligence", ["Knowledge representation", "Planning", "Machine learning", "Deep learning", "Reinforcement learning", "Natural language processing", "Computer vision", "Robotics"]),
      sub("Computer systems", ["Operating systems", "Distributed systems", "Databases", "Computer networks", "Cloud computing", "Fault-tolerant systems", "Cybersecurity"]),
      sub("Human-computer interaction", ["Interaction design", "Usability engineering", "Accessibility", "CSCW", "Visualization", "Ubiquitous computing"]),
    ]),
    field("Information, systems, and decision sciences", "Formal study of information, signals, systems, games, and decisions.", "computerScience", [
      sub("Information theory", ["Source coding", "Channel coding", "Rate-distortion theory", "Network information theory", "Algorithmic information theory"]),
      sub("Systems science", ["General systems theory", "Cybernetics", "Complex systems", "Network science", "Systems dynamics", "Agent-based modeling"]),
      sub("Decision sciences", ["Decision theory", "Game theory", "Social choice theory", "Utility theory", "Risk analysis", "Operations research"]),
    ]),
  ]),
  domain("Physical sciences", "Empirical sciences of matter, energy, fields, substances, and physical transformation.", [
    field("Physics", "Science of matter, energy, fields, spacetime, and fundamental interactions.", "physics", [
      sub("Classical physics", ["Classical mechanics", "Continuum mechanics", "Fluid mechanics", "Acoustics", "Thermodynamics", "Statistical mechanics", "Nonlinear dynamics"]),
      sub("Electromagnetism and optics", ["Classical electromagnetism", "Physical optics", "Geometrical optics", "Photonics", "Plasma physics", "Electrodynamics"]),
      sub("Quantum physics", ["Quantum mechanics", "Quantum field theory", "Quantum information", "Quantum optics", "Quantum foundations", "Many-body quantum theory"]),
      sub("Relativity and gravitation", ["Special relativity", "General relativity", "Gravitational waves", "Black hole physics", "Cosmological relativity", "Numerical relativity"]),
      sub("Condensed matter physics", ["Solid-state physics", "Soft matter physics", "Superconductivity", "Magnetism", "Semiconductor physics", "Topological phases", "Materials physics"]),
      sub("Particle and nuclear physics", ["Particle physics", "Nuclear structure", "Nuclear reactions", "Neutrino physics", "Hadron physics", "Accelerator physics"]),
      sub("Astrophysics and cosmology", ["Stellar astrophysics", "Galactic astronomy", "Extragalactic astronomy", "Physical cosmology", "High-energy astrophysics", "Planetary astrophysics"]),
    ]),
    field("Chemistry", "Science of substances, molecular structure, reactions, synthesis, and chemical systems.", "chemistry", [
      sub("Physical chemistry", ["Chemical thermodynamics", "Chemical kinetics", "Quantum chemistry", "Statistical mechanics in chemistry", "Spectroscopy", "Surface chemistry"]),
      sub("Organic chemistry", ["Reaction mechanisms", "Stereochemistry", "Synthetic organic chemistry", "Organometallic chemistry", "Natural products chemistry", "Polymer chemistry"]),
      sub("Inorganic chemistry", ["Coordination chemistry", "Solid-state chemistry", "Bioinorganic chemistry", "Main-group chemistry", "Organometallic chemistry", "Materials chemistry"]),
      sub("Analytical chemistry", ["Chromatography", "Mass spectrometry", "Electroanalytical chemistry", "Spectrochemical analysis", "Chemometrics", "Sensors"]),
      sub("Biochemistry and chemical biology", ["Enzymology", "Metabolism", "Structural biochemistry", "Chemical genetics", "Protein chemistry", "Nucleic acid chemistry"]),
      sub("Theoretical and computational chemistry", ["Molecular modeling", "Density functional theory", "Molecular dynamics", "Reaction path theory", "Computational spectroscopy"]),
    ]),
    field("Materials science", "Study and design of materials from atomic structure to macroscopic performance.", "engineering", [
      sub("Structural materials", ["Metallurgy", "Ceramics", "Polymers", "Composites", "Fracture mechanics", "Fatigue"]),
      sub("Functional materials", ["Electronic materials", "Magnetic materials", "Optical materials", "Biomaterials", "Energy materials", "Nanomaterials"]),
      sub("Materials characterization", ["Crystallography", "Microscopy", "Diffraction methods", "Spectroscopy of materials", "Mechanical testing"]),
    ]),
  ]),
  domain("Life sciences", "Sciences of living organisms, evolution, heredity, ecosystems, and biological function.", [
    field("Biological sciences", "Study of life across molecules, cells, organisms, populations, and ecosystems.", "biology", [
      sub("Molecular and cellular biology", ["Molecular biology", "Cell biology", "Genomics", "Proteomics", "Epigenetics", "Cell signaling", "Synthetic biology"]),
      sub("Genetics and evolution", ["Classical genetics", "Population genetics", "Evolutionary biology", "Phylogenetics", "Developmental evolution", "Molecular evolution"]),
      sub("Organismal biology", ["Botany", "Zoology", "Microbiology", "Mycology", "Parasitology", "Comparative physiology", "Developmental biology"]),
      sub("Ecology", ["Population ecology", "Community ecology", "Ecosystem ecology", "Landscape ecology", "Behavioral ecology", "Conservation biology", "Biogeography"]),
      sub("Neuroscience", ["Cellular neuroscience", "Systems neuroscience", "Cognitive neuroscience", "Computational neuroscience", "Neuroanatomy", "Neurophysiology"]),
    ]),
    field("Biomedical life sciences", "Biological sciences directed toward health, disease, and therapeutic mechanisms.", "medicine", [
      sub("Immunology", ["Innate immunity", "Adaptive immunity", "Autoimmunity", "Immunogenetics", "Tumor immunology", "Vaccine immunology"]),
      sub("Pathobiology", ["Cancer biology", "Molecular pathology", "Infectious disease biology", "Toxicology", "Inflammation biology"]),
      sub("Pharmacology", ["Pharmacodynamics", "Pharmacokinetics", "Clinical pharmacology", "Neuropharmacology", "Drug discovery", "Toxicopharmacology"]),
    ]),
  ]),
  domain("Earth, space, and environmental sciences", "Sciences of Earth systems, oceans, atmosphere, planets, space, and environment.", [
    field("Earth sciences", "Study of the solid Earth, its history, materials, and processes.", "earth", [
      sub("Geology", ["Stratigraphy", "Sedimentology", "Structural geology", "Geomorphology", "Volcanology", "Seismology", "Tectonics"]),
      sub("Geochemistry", ["Isotope geochemistry", "Aqueous geochemistry", "Organic geochemistry", "Cosmochemistry", "Biogeochemistry"]),
      sub("Geophysics", ["Geodesy", "Gravity and magnetics", "Seismic imaging", "Heat flow", "Rock physics"]),
      sub("Paleosciences", ["Paleontology", "Paleoclimatology", "Paleoceanography", "Palynology", "Geochronology"]),
    ]),
    field("Atmospheric, oceanic, and climate sciences", "Study of air, oceans, weather, climate, and coupled Earth systems.", "earth", [
      sub("Atmospheric science", ["Meteorology", "Atmospheric chemistry", "Cloud physics", "Boundary-layer meteorology", "Atmospheric dynamics"]),
      sub("Oceanography", ["Physical oceanography", "Chemical oceanography", "Biological oceanography", "Marine geology", "Coastal oceanography"]),
      sub("Climate science", ["Climate dynamics", "Climate modeling", "Paleoclimate", "Climate impacts", "Carbon cycle science", "Cryosphere science"]),
      sub("Hydrology", ["Surface hydrology", "Groundwater hydrology", "Ecohydrology", "Hydroclimatology", "Flood science"]),
    ]),
    field("Astronomy and planetary science", "Study of celestial bodies, planetary systems, and the universe.", "physics", [
      sub("Astronomy", ["Observational astronomy", "Radio astronomy", "Infrared astronomy", "Astrometry", "Time-domain astronomy"]),
      sub("Planetary science", ["Planetary geology", "Planetary atmospheres", "Exoplanet science", "Small bodies", "Astrobiology"]),
      sub("Space physics", ["Heliophysics", "Magnetospheric physics", "Ionospheric physics", "Cosmic rays", "Space weather"]),
    ]),
    field("Environmental sciences", "Study of natural and human-altered environments and sustainability problems.", "earth", [
      sub("Environmental chemistry", ["Pollutant fate", "Water chemistry", "Soil chemistry", "Atmospheric pollutants", "Environmental toxicology"]),
      sub("Environmental biology", ["Ecotoxicology", "Restoration ecology", "Biodiversity science", "Invasion biology", "Urban ecology"]),
      sub("Sustainability science", ["Coupled human-natural systems", "Life-cycle assessment", "Resilience science", "Industrial ecology", "Earth system governance"]),
    ]),
  ]),
  domain("Medical and health sciences", "Sciences of health, disease, prevention, diagnosis, treatment, and care systems.", [
    field("Clinical medicine", "Diagnosis and treatment of disease in patients.", "medicine", [
      sub("Internal medicine", ["Cardiology", "Pulmonology", "Gastroenterology", "Nephrology", "Endocrinology", "Hematology", "Rheumatology", "Infectious diseases"]),
      sub("Surgery", ["General surgery", "Cardiothoracic surgery", "Neurosurgery", "Orthopedic surgery", "Plastic surgery", "Transplant surgery"]),
      sub("Pediatrics", ["Neonatology", "Pediatric cardiology", "Pediatric oncology", "Developmental pediatrics", "Pediatric infectious diseases"]),
      sub("Psychiatry", ["Mood disorders", "Psychotic disorders", "Addiction psychiatry", "Child psychiatry", "Geriatric psychiatry"]),
      sub("Obstetrics and gynecology", ["Maternal-fetal medicine", "Reproductive endocrinology", "Gynecologic oncology", "Urogynecology"]),
      sub("Diagnostic medicine", ["Radiology", "Pathology", "Laboratory medicine", "Nuclear medicine", "Clinical genetics"]),
    ]),
    field("Public health", "Population-level health, prevention, epidemiology, and health policy.", "medicine", [
      sub("Epidemiology", ["Descriptive epidemiology", "Analytical epidemiology", "Clinical epidemiology", "Genetic epidemiology", "Infectious disease epidemiology"]),
      sub("Health systems", ["Health policy", "Health economics", "Implementation science", "Quality improvement", "Global health"]),
      sub("Preventive health", ["Vaccinology", "Nutrition science", "Occupational health", "Environmental health", "Health promotion"]),
    ]),
    field("Health professions and care sciences", "Scientific foundations of care, rehabilitation, and allied health practice.", "medicine", [
      sub("Nursing science", ["Clinical nursing", "Nursing informatics", "Patient safety", "Care transitions", "Community nursing"]),
      sub("Rehabilitation sciences", ["Physical therapy", "Occupational therapy", "Speech-language pathology", "Prosthetics and orthotics", "Rehabilitation engineering"]),
      sub("Dentistry and oral health", ["Cariology", "Periodontology", "Oral surgery", "Orthodontics", "Dental materials"]),
    ]),
  ]),
  domain("Engineering and technological sciences", "Design, construction, operation, and optimization of artifacts, infrastructure, and technical systems.", [
    field("Civil and environmental engineering", "Built environment, infrastructure, geotechnics, transport, and environmental systems.", "engineering", [
      sub("Structural engineering", ["Steel structures", "Concrete structures", "Earthquake engineering", "Bridge engineering", "Structural dynamics"]),
      sub("Geotechnical engineering", ["Soil mechanics", "Foundation engineering", "Rock engineering", "Slope stability", "Ground improvement"]),
      sub("Transportation engineering", ["Traffic flow", "Pavement engineering", "Transit systems", "Transport planning", "Intelligent transportation systems"]),
      sub("Water and environmental engineering", ["Water treatment", "Wastewater engineering", "Air pollution control", "Solid waste engineering", "Environmental remediation"]),
    ]),
    field("Mechanical and aerospace engineering", "Machines, motion, energy conversion, manufacturing, aircraft, and spacecraft.", "engineering", [
      sub("Mechanical systems", ["Machine design", "Dynamics and vibration", "Tribology", "Mechatronics", "Robotics engineering"]),
      sub("Thermal and fluid engineering", ["Heat transfer", "Combustion", "Turbomachinery", "HVAC engineering", "Multiphase flow"]),
      sub("Aerospace engineering", ["Aerodynamics", "Flight mechanics", "Propulsion", "Spacecraft design", "Orbital mechanics"]),
      sub("Manufacturing engineering", ["Machining", "Additive manufacturing", "Process planning", "Metrology", "Quality engineering"]),
    ]),
    field("Electrical, computer, and communication engineering", "Circuits, signals, power, electronics, computing hardware, and communications.", "engineering", [
      sub("Electrical engineering", ["Circuit theory", "Power systems", "Power electronics", "Control engineering", "Signal processing"]),
      sub("Electronics and photonics", ["Microelectronics", "Semiconductor devices", "Analog electronics", "Digital electronics", "Optoelectronics"]),
      sub("Communications engineering", ["Wireless communications", "Coding and modulation", "Antenna engineering", "Network engineering", "Satellite communications"]),
      sub("Computer engineering", ["Computer architecture", "Embedded systems", "VLSI design", "Hardware security", "Real-time systems"]),
    ]),
    field("Chemical, biological, and materials engineering", "Industrial transformation of matter, biological systems, and materials.", "engineering", [
      sub("Chemical engineering", ["Transport phenomena", "Reaction engineering", "Separation processes", "Process control", "Process safety"]),
      sub("Bioengineering", ["Biomedical engineering", "Tissue engineering", "Bioprocess engineering", "Biomechanics", "Neural engineering"]),
      sub("Materials engineering", ["Materials processing", "Corrosion engineering", "Composite engineering", "Electronic materials", "Failure analysis"]),
    ]),
  ]),
  domain("Social and behavioral sciences", "Scientific study of human behavior, societies, institutions, economies, and cultures.", [
    field("Economics", "Study of production, distribution, choice, markets, and economic systems.", "social", [
      sub("Microeconomics", ["Consumer theory", "Producer theory", "Market design", "Industrial organization", "Behavioral economics"]),
      sub("Macroeconomics", ["Growth theory", "Business cycles", "Monetary economics", "Fiscal policy", "International macroeconomics"]),
      sub("Econometrics", ["Causal inference", "Time-series econometrics", "Panel data", "Structural estimation", "Bayesian econometrics"]),
      sub("Applied economics", ["Labor economics", "Development economics", "Health economics", "Environmental economics", "Public economics"]),
    ]),
    field("Sociology", "Study of social life, institutions, groups, inequality, and social change.", "social", [
      sub("Social theory", ["Classical sociology", "Symbolic interactionism", "Conflict theory", "Rational choice sociology", "Network theory"]),
      sub("Social stratification", ["Class analysis", "Race and ethnicity", "Gender studies in sociology", "Social mobility", "Inequality measurement"]),
      sub("Institutions and culture", ["Sociology of family", "Sociology of religion", "Sociology of education", "Sociology of organizations", "Cultural sociology"]),
      sub("Demography", ["Fertility", "Mortality", "Migration", "Population aging", "Population projections"]),
    ]),
    field("Political science", "Study of power, governance, states, political behavior, and institutions.", "social", [
      sub("Political theory", ["Normative political theory", "Democratic theory", "Justice theory", "State theory", "Constitutional theory"]),
      sub("Comparative politics", ["Regime studies", "Political parties", "Electoral systems", "State capacity", "Political development"]),
      sub("International relations", ["Realism", "Liberal institutionalism", "Constructivism", "Security studies", "International political economy"]),
      sub("Public policy and administration", ["Policy analysis", "Public management", "Regulation", "Governance", "Program evaluation"]),
    ]),
    field("Anthropology and archaeology", "Study of humans, cultures, societies, biological variation, and material remains.", "social", [
      sub("Cultural anthropology", ["Ethnography", "Kinship studies", "Economic anthropology", "Medical anthropology", "Anthropology of religion"]),
      sub("Biological anthropology", ["Human evolution", "Primatology", "Bioarchaeology", "Human variation", "Forensic anthropology"]),
      sub("Archaeology", ["Prehistoric archaeology", "Classical archaeology", "Archaeometry", "Landscape archaeology", "Zooarchaeology"]),
    ]),
  ]),
  domain("Cognitive, linguistic, and communication sciences", "Sciences of mind, language, communication, learning, and information behavior.", [
    field("Psychology", "Scientific study of mind, behavior, emotion, cognition, and development.", "psychology", [
      sub("Cognitive psychology", ["Attention", "Memory", "Perception", "Decision making", "Problem solving", "Psycholinguistics"]),
      sub("Developmental psychology", ["Infant cognition", "Language development", "Social development", "Cognitive development", "Aging"]),
      sub("Social and personality psychology", ["Attitudes", "Social cognition", "Group processes", "Personality traits", "Emotion"]),
      sub("Clinical psychology", ["Psychopathology", "Psychological assessment", "Psychotherapy research", "Trauma psychology", "Health psychology"]),
      sub("Quantitative psychology", ["Psychometrics", "Item response theory", "Experimental design", "Measurement theory", "Meta-analysis"]),
    ]),
    field("Cognitive science", "Interdisciplinary science of mind, intelligence, representation, and learning.", "psychology", [
      sub("Cognitive modeling", ["Symbolic cognition", "Connectionist models", "Bayesian cognition", "Embodied cognition", "Cognitive architectures"]),
      sub("Perception and action", ["Vision science", "Audition", "Motor control", "Sensorimotor integration", "Multisensory perception"]),
      sub("Learning and intelligence", ["Concept learning", "Reasoning", "Categorization", "Cognitive development", "Artificial intelligence links"]),
    ]),
    field("Linguistics", "Scientific study of language structure, use, acquisition, and change.", "linguistics", [
      sub("Core linguistics", ["Phonetics", "Phonology", "Morphology", "Syntax", "Semantics", "Pragmatics"]),
      sub("Language in mind and society", ["Psycholinguistics", "Sociolinguistics", "Neurolinguistics", "Language acquisition", "Bilingualism"]),
      sub("Historical and comparative linguistics", ["Language change", "Comparative method", "Etymology", "Typology", "Dialectology"]),
      sub("Applied and computational linguistics", ["Corpus linguistics", "Translation studies", "Language documentation", "Computational linguistics", "Speech technology"]),
    ]),
    field("Communication and information studies", "Study of communication systems, media, knowledge organization, and information behavior.", "linguistics", [
      sub("Communication science", ["Interpersonal communication", "Mass communication", "Political communication", "Health communication", "Organizational communication"]),
      sub("Information science", ["Information retrieval", "Knowledge organization", "Bibliometrics", "Human information behavior", "Digital libraries"]),
    ]),
  ]),
  domain("Agricultural, food, and veterinary sciences", "Sciences of crops, animals, food systems, soil, farms, and veterinary health.", [
    field("Agricultural sciences", "Scientific foundations of crop, soil, farm, and agroecosystem management.", "agriculture", [
      sub("Crop science", ["Plant breeding", "Crop physiology", "Weed science", "Seed science", "Horticulture", "Agroecology"]),
      sub("Soil and land science", ["Soil fertility", "Soil microbiology", "Soil physics", "Soil conservation", "Land evaluation"]),
      sub("Agricultural systems", ["Farming systems", "Precision agriculture", "Irrigation science", "Agricultural economics", "Agroforestry"]),
    ]),
    field("Animal and veterinary sciences", "Science of domesticated animals, animal production, and veterinary health.", "agriculture", [
      sub("Animal science", ["Animal nutrition", "Animal breeding", "Livestock systems", "Poultry science", "Dairy science", "Aquaculture"]),
      sub("Veterinary medicine", ["Veterinary pathology", "Veterinary epidemiology", "Small animal medicine", "Large animal medicine", "Zoonotic disease"]),
    ]),
    field("Food sciences", "Science of food composition, processing, safety, nutrition, and sensory quality.", "agriculture", [
      sub("Food chemistry", ["Food proteins", "Food lipids", "Food carbohydrates", "Flavor chemistry", "Food additives"]),
      sub("Food engineering", ["Food processing", "Thermal processing", "Packaging science", "Drying and dehydration", "Rheology"]),
      sub("Food safety and microbiology", ["Foodborne pathogens", "Predictive microbiology", "HACCP science", "Fermentation", "Shelf-life science"]),
    ]),
  ]),
  domain("Scientific methods, data, and metascience", "Cross-cutting methods for evidence, measurement, modeling, data, reproducibility, and science itself.", [
    field("Research methodology", "Design and evaluation of systematic inquiry across sciences.", "methods", [
      sub("Experimental design", ["Randomized experiments", "Factorial designs", "Blocking", "Power analysis", "Quasi-experiments"]),
      sub("Measurement science", ["Metrology", "Validity theory", "Reliability", "Calibration", "Uncertainty quantification"]),
      sub("Qualitative and mixed methods", ["Ethnographic methods", "Interview methods", "Grounded theory", "Content analysis", "Mixed-methods design"]),
    ]),
    field("Statistics and data science", "Methods for data, inference, prediction, uncertainty, and computation.", "methods", [
      sub("Statistical inference", ["Frequentist inference", "Bayesian inference", "Likelihood theory", "Resampling", "Multiple testing"]),
      sub("Data science", ["Data engineering", "Exploratory data analysis", "Machine learning workflows", "Visualization", "Responsible data science"]),
      sub("Computational modeling", ["Simulation", "Agent-based models", "Monte Carlo methods", "Sensitivity analysis", "Model validation"]),
    ]),
    field("Metascience and science studies", "Scientific study of science, research systems, evidence, and knowledge production.", "methods", [
      sub("Philosophy of science", ["Confirmation theory", "Explanation", "Scientific realism", "Causation", "Reduction and emergence"]),
      sub("Science and technology studies", ["Sociology of scientific knowledge", "Innovation studies", "Laboratory studies", "Technology assessment", "Responsible innovation"]),
      sub("Research integrity", ["Reproducibility", "Open science", "Peer review", "Publication bias", "Research ethics"]),
    ]),
  ]),
];

function work(authors, title, year, why) {
  return { authors, title, year, why_it_matters: why };
}

function domain(name, summary, children) {
  return node(name, summary, "domain", "methods", children);
}

function field(name, summary, seed, children) {
  return node(name, summary, "field", seed, children);
}

function sub(name, specialties) {
  return {
    kind: "subfield",
    name,
    summary: `${name} organizes specialist research areas and methods within its parent field.`,
    specialties,
  };
}

function node(name, summary, taxonomyRole, seed, children = []) {
  return {
    name,
    summary,
    taxonomyRole,
    seed,
    keywords: keywords(name),
    children,
  };
}

function specialtyNode(name, parent, seed) {
  const works = WORKS[seed] || WORKS.methods;
  return {
    name,
    summary: `${name} is a Level 4 specialty within ${parent.name}.`,
    taxonomyRole: "specialty",
    keywords: keywords(`${name} ${parent.name}`),
    seminalWorks: [
      ...works.slice(0, 2),
      work("Specialist literature", `Foundational papers and monographs on ${name}`, "various", `Topic-specific starting point for ${name}; verify exact canonical works in a scholarly index.`),
    ],
    readingList: readingList(name, parent.name, works),
    children: [],
  };
}

function readingList(topic, parent, works) {
  return {
    basic: [
      `Introductory textbook chapter on ${parent}`,
      `Survey article introducing ${topic}`,
    ],
    intermediate: [
      `Specialist handbook chapter on ${topic}`,
      works[0]?.title || `Classic work connected to ${topic}`,
    ],
    advanced: [
      works[1]?.title || `Advanced monograph connected to ${topic}`,
      `Recent review articles and open problems in ${topic}`,
    ],
  };
}

function keywords(value) {
  return [...new Set(String(value).toLowerCase().split(/[^a-z0-9]+/).filter((part) => part.length > 2))].slice(0, 8);
}

function expandTree(roots) {
  return roots.map((root) => ({
    ...root,
    children: root.children.map((fieldNode) => ({
      ...fieldNode,
      children: fieldNode.children.map((subfield) => ({
        name: subfield.name,
        summary: subfield.summary,
        taxonomyRole: "subfield",
        keywords: keywords(`${subfield.name} ${fieldNode.name}`),
        children: subfield.specialties.map((name) => specialtyNode(name, subfield, fieldNode.seed)),
      })),
    })),
  }));
}

function count(nodes, depth = 1, counts = {}) {
  for (const item of nodes) {
    counts[depth] = (counts[depth] || 0) + 1;
    count(item.children || [], depth + 1, counts);
  }
  return counts;
}

const roots = expandTree(TAXONOMY);
const counts = count(roots);
const payload = {
  title: "Human Scientific Knowledge Taxonomy",
  generated_at: new Date().toISOString(),
  scope_note: "New curated taxonomy created for this app; it does not reuse the earlier science_taxonomy.json dataset.",
  level_definitions: {
    1: "Major scientific knowledge domains",
    2: "Disciplines and broad fields",
    3: "Subdisciplines",
    4: "Specialist fields with reading scaffolds and seminal-work pointers",
  },
  counts,
  roots,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
console.log(counts);
