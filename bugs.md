# Known bugs

## Variant -> value -> feature -> domain

Will not return domain details if it's a global feature

```
query {
  listModules {
    variants {
      name
      values {
        feature {
          name
          domain {
            name
          }
        }
        value
      }
    }
  }
}
```

## Slow lookup of variant -> value -> feature -> domain

Currently it does full scan for each value, should use map instead of array