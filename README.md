# Algo Reparti

Une application pédagogique de visualisation d’algorithmes répartis développée en React + TypeScript + Vite.

## Présentation

Ce projet propose une interface interactive pour explorer plusieurs familles d’algorithmes distribués :

- **Horloges distribuées** : Lamport, Horloge vectorielle, Horloge matricielle
- **Diffusion de messages** : FIFO, Causal, Séquencer
- **Exclusion mutuelle** : Lamport, Ricart-Agrawala, Le Lann, Ricart avec jeton
- **Élection de leader** : Chang & Roberts, Bully, Le Lann
- **Snapshots distribués** : Coupure, État global, Chandy-Lamport

L’application permet de naviguer entre ces algorithmes via une barre latérale et de suivre les étapes d’exécution à travers des timelines et des simulations.

## Structure du projet

- `src/algorithms/` : implémentations des algorithmes et scénarios de simulation
- `src/pages/` : pages de navigation pour chaque algorithme
- `src/components/` : composants d’interface réutilisables (timeline, canvas, contrôles)
- `src/common/` : éléments globaux comme le header et la sidebar
- `src/router/` : configuration des routes de l’application
- `src/styles/` : styles CSS par page et par composant
- `src/types/` : définitions TypeScript partagées

## Routes principales

- `/mutex/lamport`
- `/mutex/ricart`
- `/mutex/lelann`
- `/mutex/ricarttoken`
- `/diffusion/fifo`
- `/diffusion/causal`
- `/diffusion/sequencer`
- `/election/:algo`
- `/clocks/:algo`
- `/snapshot/cut`
- `/snapshot/global`
- `/snapshot/chandy`

## Installation

Installer les dépendances :

```bash
npm install
```

## Commandes utiles

- `npm run dev` : démarre le serveur de développement Vite
- `npm run build` : construit l’application pour production
- `npm run lint` : lance ESLint sur le projet
- `npm run preview` : prévisualise la version construite

## Technologies

- React 19
- TypeScript 6
- Vite 8
- React Router DOM 7
- ESLint

## Objectif

Ce projet sert de support pour l’étude des algorithmes répartis et des protocoles de coordination. Il facilite la compréhension des comportements des processus distribués grâce à des visualisations et des scénarios pas à pas.


