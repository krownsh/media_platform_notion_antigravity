const fs = require('fs');
const path = require('path');

const walk = function (dir, done) {
    let results = [];
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        let pending = list.length;
        if (!pending) return done(null, results);
        list.forEach(function (file) {
            file = path.resolve(dir, file);
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function (err, res) {
                        results = results.concat(res);
                        if (!--pending) done(null, results);
                    });
                } else {
                    results.push(file);
                    if (!--pending) done(null, results);
                }
            });
        });
    });
};

const replacements = [
    [/glass-card/g, "notion-card"],
    [/glass-panel/g, "bg-white notion-whisper-border shadow-soft-card"],
    [/text-foreground/g, "text-[rgba(0,0,0,0.95)]"],
    [/text-muted-foreground/g, "text-[#615d59]"],
    [/text-accent/g, "text-[#0075de]"],
    [/bg-accent\/10/g, "bg-[rgba(0,117,222,0.1)]"],
    [/bg-accent/g, "bg-[#0075de]"],
    [/bg-secondary\/20/g, "bg-black/5"],
    [/bg-secondary\/30/g, "bg-black/5"],
    [/bg-secondary\/10/g, "bg-black/5"],
    [/bg-secondary\/40/g, "bg-black/5"],
    [/bg-white\/[0-9]+/g, "bg-transparent"],
    [/border-white\/[0-9]+/g, "notion-whisper-border"],
    [/border-border/g, "border-[rgba(0,0,0,0.1)]"],
    [/shadow-sm/g, "shadow-soft-card"],
    [/shadow-md/g, "shadow-soft-card"],
    [/shadow-lg/g, "shadow-deep"],
    [/shadow-xl/g, "shadow-deep"],
    [/rounded-2xl|rounded-3xl|rounded-xl/g, "rounded-lg"],
];

walk('d:\\others\\sideproject\\media_platform_notion_antigravity\\src', function (err, results) {
    if (err) throw err;
    results.forEach(file => {
        if (file.endsWith('.jsx') || file.endsWith('.js')) {
            let content = fs.readFileSync(file, 'utf8');
            let modified = content;
            replacements.forEach(([pattern, replaceObj]) => {
                modified = modified.replace(pattern, replaceObj);
            });
            if (content !== modified) {
                fs.writeFileSync(file, modified, 'utf8');
                console.log("Updated: " + file);
            }
        }
    });
});
