---
layout: default
title: "Hunt Projects"
description: "Search for abandoned GitHub repositories with revival potential"
---

<div id="hunt-app">
    <div class="hunt-intro" style="text-align: center; margin-bottom: 2rem;">
        <h1 style="color: var(--kraven-primary); font-size: 2.5rem; margin-bottom: 1rem;">
            <i class="fas fa-search"></i> Hunt for Abandoned Projects
        </h1>
        <p style="font-size: 1.2rem; color: rgba(255, 255, 255, 0.8); max-width: 600px; margin: 0 auto;">
            Discover abandoned GitHub repositories with high revival potential. Use our advanced filters to find the perfect project to adopt and revitalize.
        </p>
    </div>

    <div class="search-container" style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 3rem; box-shadow: 0 8px 32px rgba(0,0,0,0.2); margin: 3rem auto; max-width: 1000px; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px);">
        <h2 style="text-align: center; color: #fff; margin-bottom: 3rem; font-size: 1.8rem;">
            <i class="fas fa-filter" style="color: var(--kraven-primary);"></i>
            Search Filters
        </h2>
        
        <form id="searchForm" class="search-form">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; margin-bottom: 3rem;">
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label for="language" style="font-weight: 600; margin-bottom: 0.8rem; display: block; color: #fff; font-size: 1.05rem;">Programming Language</label>
                    <select id="language" name="language" style="width: 100%; padding: 1rem; border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; font-size: 1rem; background: rgba(0, 0, 0, 0.3); color: #fff; transition: all 0.3s ease;">
                        <option value="">Any Language</option>
                        <option value="javascript">JavaScript</option>
                        <option value="typescript">TypeScript</option>
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                        <option value="go">Go</option>
                        <option value="rust">Rust</option>
                        <option value="cpp">C++</option>
                        <option value="csharp">C#</option>
                        <option value="php">PHP</option>
                        <option value="ruby">Ruby</option>
                    </select>
                </div>

                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label for="category" style="font-weight: 600; margin-bottom: 0.8rem; display: block; color: #fff; font-size: 1.05rem;">Project Category</label>
                    <select id="category" name="category" style="width: 100%; padding: 1rem; border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; font-size: 1rem; background: rgba(0, 0, 0, 0.3); color: #fff; transition: all 0.3s ease;">
                        <option value="">Any Category</option>
                        <option value="cli-tool">CLI Tools</option>
                        <option value="build-tool">Build Tools</option>
                        <option value="dev-tool">Developer Tools</option>
                        <option value="testing">Testing Frameworks</option>
                        <option value="linter">Code Quality</option>
                        <option value="framework">Frameworks</option>
                        <option value="library">Libraries</option>
                        <option value="plugin">Plugins</option>
                    </select>
                </div>

                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label for="minStars" style="font-weight: 600; margin-bottom: 0.8rem; display: block; color: #fff; font-size: 1.05rem;">Minimum Stars</label>
                    <input type="number" id="minStars" name="minStars" placeholder="e.g. 100" min="0" style="width: 100%; padding: 1rem; border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; font-size: 1rem; background: rgba(0, 0, 0, 0.3); color: #fff; transition: all 0.3s ease;">
                </div>

                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label for="maxStars" style="font-weight: 600; margin-bottom: 0.8rem; display: block; color: #fff; font-size: 1.05rem;">Maximum Stars</label>
                    <input type="number" id="maxStars" name="maxStars" placeholder="e.g. 5000" min="0" style="width: 100%; padding: 1rem; border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; font-size: 1rem; background: rgba(0, 0, 0, 0.3); color: #fff; transition: all 0.3s ease;">
                </div>

                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label for="pushedBefore" style="font-weight: 600; margin-bottom: 0.8rem; display: block; color: #fff; font-size: 1.05rem;">Last Updated Before</label>
                    <input type="date" id="pushedBefore" name="pushedBefore" style="width: 100%; padding: 1rem; border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; font-size: 1rem; background: rgba(0, 0, 0, 0.3); color: #fff; transition: all 0.3s ease;">
                </div>

                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label for="githubToken" style="font-weight: 600; margin-bottom: 0.8rem; display: block; color: #fff; font-size: 1.05rem;">GitHub Token (Optional)</label>
                    <input type="password" id="githubToken" name="githubToken" placeholder="ghp_... (for higher rate limits)" style="width: 100%; padding: 1rem; border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px; font-size: 1rem; background: rgba(0, 0, 0, 0.3); color: #fff; transition: all 0.3s ease;">
                    <small style="color: rgba(255, 255, 255, 0.7); font-size: 0.9rem; margin-top: 0.5rem; display: block;">Increases rate limit from 60 to 5000 requests/hour</small>
                </div>
            </div>

            <div style="text-align: center; margin-top: 2rem;">
                <button type="submit" id="searchBtn" style="background: linear-gradient(45deg, var(--kraven-primary), var(--kraven-secondary)); color: white; border: none; padding: 1.2rem 2.5rem; border-radius: 10px; font-size: 1.1rem; font-weight: 600; cursor: pointer; margin-right: 1.5rem; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);">
                    <i class="fas fa-spider"></i> Start Hunting
                </button>
                <button type="button" id="clearBtn" style="background: #6c757d; color: white; border: none; padding: 1.2rem 2.5rem; border-radius: 10px; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
                    <i class="fas fa-eraser"></i> Clear
                </button>
            </div>
        </form>
    </div>

    <!-- Loading -->
    <div id="loading" class="loading" style="display: none; text-align: center; padding: 3rem;">
        <div style="width: 50px; height: 50px; border: 4px solid rgba(255, 255, 255, 0.2); border-top: 4px solid var(--kraven-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
        <p style="font-size: 1.1rem; color: rgba(255, 255, 255, 0.8);">🕷️ Kraven is hunting for abandoned projects...</p>
    </div>

    <!-- Results -->
    <div id="results" class="results-section" style="display: none;">
        <div class="results-container" style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 3rem; box-shadow: 0 8px 32px rgba(0,0,0,0.2); margin: 3rem auto; max-width: 1200px; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px);">
            <div class="results-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; flex-wrap: wrap; gap: 1.5rem;">
                <h2 style="color: #fff; display: flex; align-items: center; gap: 0.5rem; font-size: 1.8rem;">
                    <i class="fas fa-trophy" style="color: var(--kraven-primary);"></i>
                    Hunt Results
                </h2>
                <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                    <span id="resultsCount" style="color: rgba(255, 255, 255, 0.8);">0 repositories found</span>
                    <button id="exportJson" style="background: #28a745; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; transition: all 0.3s ease;">
                        <i class="fas fa-download"></i> Export JSON
                    </button>
                    <button id="sortResults" style="background: #17a2b8; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; transition: all 0.3s ease;">
                        <i class="fas fa-sort"></i> Sort by Revival Potential
                    </button>
                </div>
            </div>
            
            <div id="resultsContainer">
                <!-- Results will be populated here -->
            </div>
        </div>
    </div>

    <!-- Rate Limit Info -->
    <div id="rateLimitInfo" style="position: fixed; top: 20px; right: 20px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 0.75rem 1rem; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); font-size: 0.9rem; z-index: 1000; border: 1px solid rgba(255, 255, 255, 0.2); color: #fff;">
        <i class="fas fa-tachometer-alt" style="color: var(--kraven-primary);"></i>
        <span id="rateLimitText">Rate limit: Unknown</span>
    </div>
</div>

<!-- Include the original JavaScript -->
<script src="{{ '/js/github-api.js' | relative_url }}"></script>
<script src="{{ '/js/app.js' | relative_url }}"></script>

<style>
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.repo-card {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
}

.repo-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    border-color: var(--kraven-primary);
    background: rgba(255, 255, 255, 0.12);
}

.repo-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 1rem;
}

.repo-title a {
    color: var(--kraven-primary);
    text-decoration: none;
    font-size: 1.3rem;
    font-weight: bold;
}

.repo-title a:hover {
    text-decoration: underline;
}

.repo-status {
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: bold;
    text-transform: uppercase;
}

.status-prime {
    background: #28a745;
    color: white;
}

.status-maybe {
    background: #ffc107;
    color: #333;
}

.status-skip {
    background: #dc3545;
    color: white;
}

.repo-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
}

.stat {
    text-align: center;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-value {
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--kraven-primary);
    display: block;
}

.stat-label {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
}
</style>
