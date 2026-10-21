# Check-list avant mise en ligne

À faire dans l'ordre. Coche au fur et à mesure (dans VS Code : aperçu Markdown, ou tape `x` entre les crochets).
Si une étape échoue, note le message exact : c'est ce qu'il faudra me donner.

## 0. Préparation (Supabase)

### 0.1 Appliquer les 3 nouvelles migrations
- [ ] Les trois fichiers à appliquer, dans cet ordre :
  1. `supabase/migrations/20261020180000_user_guides.sql` (comptes, propriétaire, limites)
  2. `supabase/migrations/20261020190000_guide_authors.sql` (pseudo de l'auteur)
  3. `supabase/migrations/20261020200000_site_pages.sql` (page About us)
- [ ] **Voie A, ligne de commande** : `npm run db:login`, puis `npm run db:link` (demande le mot de passe de la base), puis `npm run db:dry-run` (doit lister ces 3 fichiers et aucun autre), puis `npx supabase db push` (**sans** `--include-seed`).
- [ ] **Voie B, sans ligne de commande** : dans Supabase, SQL Editor > New query, colle **un fichier à la fois** et clique Run. Ne colle **pas** `schema.sql` en entier : il se termine par une ligne qui ajoute une adresse email d'exemple dans la liste des administrateurs.
- [ ] Vérifier que tout est bien passé : dans le SQL Editor, lance
  ```sql
  select
    exists (select 1 from information_schema.columns where table_name = 'places'  and column_name = 'owner_id')    as places_owner,
    exists (select 1 from information_schema.columns where table_name = 'guides'  and column_name = 'owner_id')    as guides_owner,
    exists (select 1 from information_schema.columns where table_name = 'guides'  and column_name = 'author_name') as guides_author,
    to_regclass('public.site_pages') is not null                                                                   as site_pages;
  ```
  Les quatre colonnes doivent valoir `true`.

### 0.2 Réglages du tableau de bord
- [ ] Authentication > Sign In / Providers > Email : « Allow new users to sign up » **activé**.
- [ ] Même écran : « Confirm email » **activé** (pour la mise en ligne). Pour tes tests, tu peux éviter les emails en créant les comptes à la main (étape suivante).
- [ ] Ton adresse admin est bien dans `site_owners` (SQL Editor : `select * from public.site_owners;`).

### 0.3 Deux comptes de test (sans email)
- [ ] Authentication > Users > Add user : crée `test-a@exemple.com` et `test-b@exemple.com` avec un mot de passe, en cochant **Auto Confirm User**.
- [ ] Lance le site : `npm run dev`, et ouvre l'adresse affichée.

## 1. Visiteur (non connecté)
Navigue dans une fenêtre privée.
- [ ] La page d'accueil s'affiche, la carte montre tous les lieux, aucun outil d'édition (pas de champ de recherche, pas de « + Add »).
- [ ] Un clic sur un pin ou un filtre de catégorie met à jour le panneau.
- [ ] Menu (bouton en haut à gauche) : Map, Guides, Comments, About us, Log in. Chaque entrée fonctionne.
- [ ] Guides : la liste s'affiche avec « Log in to create your own guide » et sans boutons Edit/Delete.
- [ ] Ouvre un guide avec au moins 2 lieux : durée totale, durées entre les étapes, tracé en pointillés, pins numérotés.
- [ ] About us : le texte s'affiche, sans bouton « Edit this page ».
- [ ] Commentaires : poste un commentaire, il apparaît.
- [ ] Le zoom de la carte (boutons, pincement ou Ctrl + molette) est fluide.

## 2. Utilisateur A (compte normal)
- [ ] Menu > Log in, connexion avec `test-a`. Retour sur la carte ; le pied de page indique « Signed in · test-a… ».
- [ ] Le champ « Search a place to add… » apparaît. Il n'y a **pas** de « + Add » (catégories).
- [ ] Recherche « Châtelet » : « Châtelet - Les Halles » apparaît. Recherche « Les Halles » : le quartier apparaît.
- [ ] Ajoute un lieu : la photo se cherche, tu choisis une catégorie, tu écris une description, Save. Le lieu apparaît sur la carte.
- [ ] Sur ce lieu : Edit, Remove et la photo sont modifiables. Modifie-le, puis remets-le.
- [ ] Guides > « + New guide » : titre + pseudo. Le guide apparaît avec « Yours » et « by <pseudo> ».
- [ ] Ajoute au moins 3 lieux dans ce guide (depuis la carte, « In my guides », ou depuis la page du guide).
- [ ] Page du guide : change l'ordre des étapes en **glissant** la poignée ⠿, puis avec ↑ ↓. Les durées et le tracé se mettent à jour.
- [ ] Modifie le pseudo et l'introduction (Edit guide). Recharge la page : tout est conservé.
- [ ] Sur un lieu ou un guide de **l'admin** : aucun bouton Edit / Remove / Delete.
- [ ] Ouvre About us : toujours pas de bouton de modification.

## 3. Utilisateur B (isolement entre comptes)
Déconnecte A, connecte-toi avec `test-b`.
- [ ] Le guide et le lieu de A sont visibles, mais **sans** boutons Edit / Delete / Remove.
- [ ] Sur la page du guide de A : pas de glisser-déposer, pas de ↑ ↓, pas « Add a place ».
- [ ] « In my guides » ne propose **pas** les guides de A.
- [ ] Crée un guide à toi, ajoute-y un lieu de A (c'est permis).

## 4. Administrateur (toi)
- [ ] Connexion avec ton compte admin : le pied de page indique « Admin ».
- [ ] « + Add » (nouvelle catégorie) est disponible, et uniquement pour toi.
- [ ] Tu peux modifier et supprimer les lieux et guides de A et B (modération).
- [ ] About us > « Edit this page » : change le titre et le texte (une ligne vide = nouveau paragraphe), Save, recharge : c'est conservé. Déconnecte-toi : la page reste modifiée pour les visiteurs.
- [ ] Nettoyage : supprime les lieux et guides de test.

## 5. Sécurité (la base refuse ce que le site cache)
Les boutons cachés ne suffisent pas : la base doit refuser même si on contourne le site.
- [ ] Un visiteur non connecté ne peut rien écrire (déjà vérifié sur `places` et `categories`).
- [ ] B ne peut pas modifier ni supprimer ce que A a créé. Ici, on ne peut le prouver que côté base : demande-moi un petit script de test d'API (il se connecte avec `test-a` et `test-b` et tente les actions interdites), et lance-le après l'étape 0.
- [ ] Limite de quota (optionnel) : avec un compte normal, crée 21 guides ; le 21e doit être refusé avec « Limit reached ».

## 6. Mobile
Sur ton ordinateur : `npm run dev -- --host`, puis ouvre l'adresse « Network » affichée depuis ton téléphone (même Wi-Fi).
- [ ] Le titre, le bouton menu et le menu latéral sont lisibles et utilisables.
- [ ] La carte se déplace et se zoome au doigt, sans bloquer le défilement de la page.
- [ ] Le panneau d'un lieu, la recherche, les guides sont utilisables.
- [ ] Page d'un guide : les boutons ↑ ↓ fonctionnent (le glisser-déposer natif ne marche en général pas au doigt).
- [ ] Les durées et la carte d'itinéraire restent lisibles.

## 7. Versionner et mettre en ligne
### Git
- [ ] `git init`, puis vérifie que `.env` n'apparaît **pas** dans `git status` (il est dans `.gitignore`).
- [ ] `git add .` puis `git commit -m "Premier commit"`.
- [ ] (Conseillé) crée un dépôt privé sur GitHub et pousse-le : c'est ta sauvegarde.

### Hébergement (Netlify ou Vercel)
- [ ] Nouveau site depuis le dépôt. Commande de build : `npm run build`, dossier publié : `dist`.
- [ ] Variables d'environnement : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (la clé **publique**, jamais la secrète), `VITE_MAPTILER_KEY`, `VITE_SITE_URL` (l'adresse du site en ligne).
- [ ] Supabase > Authentication > URL Configuration : mets l'adresse du site dans **Site URL** et **Redirect URLs**, sinon les liens des emails de confirmation pointeront ailleurs.
- [ ] Supabase > Authentication > Emails > SMTP Settings : branche un vrai serveur d'envoi (celui de Supabase est limité à quelques messages par heure).
- [ ] MapTiler > ta clé : restreins-la à l'adresse du site.
- [ ] Refais rapidement les étapes 1, 2 et 4 sur le site en ligne, avec un vrai compte créé via « Sign up » (email de confirmation inclus).
- [ ] Partage le lien dans une messagerie : l'aperçu (titre et image) s'affiche.

## À noter pendant les tests
Pour chaque problème : la page, ce que tu as fait, le message affiché (ou la capture), et le navigateur. Donne-moi la liste et je corrige.
