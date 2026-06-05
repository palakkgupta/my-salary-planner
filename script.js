document.addEventListener("DOMContentLoaded", function() {
    const categories = [
        { name: "Groceries", pct: 0.08 },
        { name: "Lifestyle", pct: 0.05 },
        { name: "Gold", pct: 0.10 },
        { name: "Small Cap MF", pct: 0.15 },
        { name: "Mid Cap MF", pct: 0.10 },
        { name: "Large Cap MF", pct: 0.05 },
        { name: "Cash Savings", pct: 0.30 },
        { name: "Parents Needs", pct: 0.17 }
    ];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const appDiv = document.getElementById("app");

    months.forEach(month => {
        const block = document.createElement("div");
        block.className = "month-block";
        
        const header = document.createElement("h2");
        header.textContent = month;
        block.appendChild(header);

        const salaryLabel = document.createElement("label");
        salaryLabel.textContent = "Salary: ";
        const salaryInput = document.createElement("input");
        salaryInput.type = "number";
        salaryInput.value = 0;
        salaryInput.className = "salary-input";
        salaryInput.min = 0;
        salaryLabel.appendChild(salaryInput);
        block.appendChild(salaryLabel);

        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        ["Category", "%", "Target", "Achieved"].forEach(text => {
            const th = document.createElement("th");
            th.textContent = text;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        categories.forEach(cat => {
            const tr = document.createElement("tr");
            const tdName = document.createElement("td");
            tdName.textContent = cat.name;
            tr.appendChild(tdName);
            const tdPct = document.createElement("td");
            tdPct.textContent = (cat.pct * 100).toFixed(0) + "%";
            tr.appendChild(tdPct);
            const tdTarget = document.createElement("td");
            tdTarget.textContent = "₹0";
            tr.appendChild(tdTarget);
            const tdAchieved = document.createElement("td");
            tdAchieved.className = "achieved-cell";
            tdAchieved.textContent = "-";
            tr.appendChild(tdAchieved);

            // Achieved toggle
            tdAchieved.addEventListener("click", function() {
                if (tdAchieved.textContent === "✔") {
                    tdAchieved.textContent = "✘";
                    tdAchieved.classList.remove("achieved-checked");
                    tdAchieved.classList.add("achieved-crossed");
                } else if (tdAchieved.textContent === "✘") {
                    tdAchieved.textContent = "-";
                    tdAchieved.classList.remove("achieved-crossed");
                } else {
                    tdAchieved.textContent = "✔";
                    tdAchieved.classList.add("achieved-checked");
                }
            });

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        block.appendChild(table);

        // Update targets when salary input changes
        salaryInput.addEventListener("input", function() {
            const sal = parseFloat(salaryInput.value) || 0;
            Array.from(tbody.children).forEach((tr, idx) => {
                const targetCell = tr.children[2];
                const pct = categories[idx].pct;
                targetCell.textContent = "₹" + (sal * pct).toFixed(0);
            });
        });

        appDiv.appendChild(block);
    });
});
