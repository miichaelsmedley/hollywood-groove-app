# Contributing to Hollywood Groove Mobile App

## 5 Core Rules

### 1. Branch Naming
- Feature: `feature/issue-123-description`
- Bug fix: `bugfix/issue-123-description`
- Example: `feature/issue-4-show-listing`

### 2. Commits
- Clear, descriptive messages
- Reference issue: `feat: implement show listing (closes #4)`
- Format: `type: description`
- Types: feat, fix, docs, style, refactor, test, chore

### 3. Pull Requests
- Title references issue: `#4 - Implement show listing`
- Description explains what and why
- All CI checks must pass
- At least 1 approval required

### 4. C# Code Style
- PascalCase for classes, methods, properties
- camelCase for local variables, parameters
- Async methods end with `Async`
- Use nullable reference types
- Follow Microsoft C# Coding Conventions

Example:
```csharp
public class ShowService
{
    public async Task<List<Show>> GetUpcomingShowsAsync()
    {
        // Implementation
    }
}
```

### 5. Testing
- Write unit tests with xUnit
- Test ViewModels and Services
- Aim for 80%+ code coverage
- Test on Android, iOS, and Windows before PR

Example:
```csharp
[Fact]
public async Task GetUpcomingShowsAsync_ReturnsShows()
{
    // Arrange
    var service = new ShowService();
    
    // Act
    var shows = await service.GetUpcomingShowsAsync();
    
    // Assert
    Assert.NotEmpty(shows);
}
```

## Getting Started

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request
