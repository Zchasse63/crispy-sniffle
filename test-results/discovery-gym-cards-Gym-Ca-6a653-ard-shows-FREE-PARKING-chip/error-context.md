# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: discovery/gym-cards.spec.ts >> Gym Cards >> CARD-03: at least one card shows FREE PARKING chip
- Location: tests/e2e/discovery/gym-cards.spec.ts:36:7

# Error details

```
Test timeout of 30000ms exceeded while setting up "discoveryPage".
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:3100/", waiting until "load"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - link "Scout home" [ref=e4] [cursor=pointer]:
        - /url: /
        - img [ref=e6]
        - generic [ref=e18]: Scout
        - generic [ref=e19]: Tampa Beta
      - navigation "Primary" [ref=e20]:
        - link "Explore" [ref=e21] [cursor=pointer]:
          - /url: /
        - link "Trips" [ref=e22] [cursor=pointer]:
          - /url: /trips
        - link "Compare" [ref=e23] [cursor=pointer]:
          - /url: /compare
        - button "Open shortlist (0 saved)" [ref=e24]:
          - img [ref=e25]
        - button "Sign in" [ref=e27]:
          - img [ref=e28]
          - text: Sign in
  - generic [ref=e32]:
    - generic [ref=e34]:
      - generic [ref=e35]:
        - heading "Find your fit." [level=1] [ref=e36]
        - paragraph [ref=e37]: Tampa quadrant · 27.9506° N · 82.4572° W
      - paragraph [ref=e38]: The equipment, amenities, and hours that actually matter — type it or say it.
      - generic [ref=e40]:
        - search [ref=e41]:
          - generic [ref=e42]:
            - img [ref=e43]
            - textbox "Describe your ideal gym" [ref=e46]:
              - /placeholder: Describe your ideal gym — “squat racks, sauna, near Hyde Park”
          - generic [ref=e47]:
            - button "Search by voice" [ref=e48]:
              - img [ref=e49]
            - button "Scout it" [disabled] [ref=e52]
        - generic [ref=e53]:
          - generic [ref=e54]: "Try:"
          - button "vibey yoga studio" [ref=e55]
          - button "lift heavy with a sauna, under $25" [ref=e56]
          - button "trendy gym that's instagram friendly" [ref=e57]
    - navigation "Gym types" [ref=e58]:
      - generic [ref=e59]:
        - button "Strength" [ref=e60]:
          - img [ref=e61]
          - generic [ref=e67]: Strength
        - button "CrossFit" [ref=e68]:
          - img [ref=e69]
          - generic [ref=e71]: CrossFit
        - button "Big" [ref=e72]:
          - img [ref=e73]
          - generic [ref=e77]: Big
        - button "Boutique" [ref=e78]:
          - img [ref=e79]
          - generic [ref=e82]: Boutique
        - button "Luxury" [ref=e83]:
          - img [ref=e84]
          - generic [ref=e86]: Luxury
        - button "Climbing" [ref=e87]:
          - img [ref=e88]
          - generic [ref=e90]: Climbing
        - button "Yoga" [ref=e91]:
          - img [ref=e92]
          - generic [ref=e97]: Yoga
        - button "MMA" [ref=e98]:
          - img [ref=e99]
          - generic [ref=e108]: MMA
        - button "Recovery" [ref=e109]:
          - img [ref=e110]
          - generic [ref=e123]: Recovery
    - generic [ref=e125]:
      - generic [ref=e126]: 35 gyms
      - group "View mode" [ref=e128]:
        - button "List" [pressed] [ref=e129]:
          - img [ref=e130]
          - text: List
        - button "Map" [ref=e131]:
          - img [ref=e132]
          - text: Map
    - generic [ref=e135]:
      - complementary [ref=e136]:
        - generic [ref=e138]:
          - generic [ref=e140]: 35 gyms
          - generic [ref=e141]:
            - heading "Near me" [level=3] [ref=e142]
            - generic [ref=e143]:
              - generic [ref=e144]:
                - button "Drive" [pressed] [ref=e145]:
                  - img [ref=e146]
                  - text: Drive
                - button "Walk" [ref=e150]:
                  - img [ref=e151]
                  - text: Walk
              - generic [ref=e154]:
                - button "10 min" [ref=e155]:
                  - img [ref=e156]
                  - text: 10 min
                - button "20 min" [ref=e159]:
                  - img [ref=e160]
                  - text: 20 min
                - button "30 min" [ref=e163]:
                  - img [ref=e164]
                  - text: 30 min
          - generic [ref=e167]:
            - heading "Amenities" [level=3] [ref=e168]
            - generic [ref=e169]:
              - generic [ref=e170] [cursor=pointer]:
                - checkbox "Sauna" [ref=e171]
                - text: Sauna
              - generic [ref=e173] [cursor=pointer]:
                - checkbox "Cold Plunge" [ref=e174]
                - text: Cold Plunge
              - generic [ref=e176] [cursor=pointer]:
                - checkbox "Steam Room" [ref=e177]
                - text: Steam Room
              - generic [ref=e179] [cursor=pointer]:
                - checkbox "Pool" [ref=e180]
                - text: Pool
              - generic [ref=e182] [cursor=pointer]:
                - checkbox "Recovery Room" [ref=e183]
                - text: Recovery Room
              - generic [ref=e185] [cursor=pointer]:
                - checkbox "Group Classes" [ref=e186]
                - text: Group Classes
              - generic [ref=e188] [cursor=pointer]:
                - checkbox "Personal Training" [ref=e189]
                - text: Personal Training
              - generic [ref=e191] [cursor=pointer]:
                - checkbox "Turf Area" [ref=e192]
                - text: Turf Area
              - generic [ref=e194] [cursor=pointer]:
                - checkbox "Basketball" [ref=e195]
                - text: Basketball
              - generic [ref=e197] [cursor=pointer]:
                - checkbox "Towel Service" [ref=e198]
                - text: Towel Service
              - generic [ref=e200] [cursor=pointer]:
                - checkbox "Childcare" [ref=e201]
                - text: Childcare
              - generic [ref=e203] [cursor=pointer]:
                - checkbox "Parking" [ref=e204]
                - text: Parking
          - generic [ref=e206]:
            - heading "Equipment" [level=3] [ref=e207]
            - generic [ref=e208]:
              - generic [ref=e209] [cursor=pointer]:
                - checkbox "Squat Racks" [ref=e210]
                - text: Squat Racks
              - generic [ref=e212] [cursor=pointer]:
                - checkbox "Lifting Platforms" [ref=e213]
                - text: Lifting Platforms
              - generic [ref=e215] [cursor=pointer]:
                - checkbox "Dumbbells" [ref=e216]
                - text: Dumbbells
              - generic [ref=e218] [cursor=pointer]:
                - checkbox "GHD" [ref=e219]
                - text: GHD
              - generic [ref=e221] [cursor=pointer]:
                - checkbox "Sled / Prowler" [ref=e222]
                - text: Sled / Prowler
              - generic [ref=e224] [cursor=pointer]:
                - checkbox "Ski Erg" [ref=e225]
                - text: Ski Erg
              - generic [ref=e227] [cursor=pointer]:
                - checkbox "Assault Bike" [ref=e228]
                - text: Assault Bike
              - generic [ref=e230] [cursor=pointer]:
                - checkbox "Rowing Machines" [ref=e231]
                - text: Rowing Machines
              - generic [ref=e233] [cursor=pointer]:
                - checkbox "Reverse Hyper" [ref=e234]
                - text: Reverse Hyper
              - generic [ref=e236] [cursor=pointer]:
                - checkbox "Belt Squat" [ref=e237]
                - text: Belt Squat
              - generic [ref=e239] [cursor=pointer]:
                - checkbox "Cable Machines" [ref=e240]
                - text: Cable Machines
              - generic [ref=e242] [cursor=pointer]:
                - checkbox "Leg Press" [ref=e243]
                - text: Leg Press
            - generic [ref=e245]:
              - generic [ref=e246]:
                - generic [ref=e247]: Squat racks
                - generic [ref=e248]:
                  - button "Decrease" [ref=e249]:
                    - img [ref=e250]
                  - generic [ref=e251]: Any
                  - button "Increase" [ref=e252]:
                    - img [ref=e253]
              - generic [ref=e254]:
                - generic [ref=e255]: Dumbbells to
                - generic [ref=e256]:
                  - button "Decrease" [ref=e257]:
                    - img [ref=e258]
                  - generic [ref=e259]: Any
                  - button "Increase" [ref=e260]:
                    - img [ref=e261]
            - generic [ref=e263]:
              - textbox "Add equipment brand filter" [ref=e264]:
                - /placeholder: Brand (e.g. Rogue)
              - button "Add brand" [ref=e265]:
                - img [ref=e266]
          - generic [ref=e267]:
            - heading "Day pass" [level=3] [ref=e268]
            - generic [ref=e269]:
              - slider "Maximum day pass price" [ref=e270]: "60"
              - generic [ref=e271]:
                - generic [ref=e272]: $5
                - generic [ref=e273]: Any price
                - generic [ref=e274]: $60+
          - generic [ref=e275]:
            - heading "Hours" [level=3] [ref=e276]
            - generic [ref=e277]:
              - generic [ref=e278] [cursor=pointer]:
                - checkbox "Open now" [ref=e279]
                - text: Open now
              - generic [ref=e281] [cursor=pointer]:
                - checkbox "24-hour access" [ref=e282]
                - text: 24-hour access
          - generic [ref=e284]:
            - heading "Neighborhood" [level=3] [ref=e285]
            - combobox "Neighborhood" [ref=e286]:
              - option "All of Tampa" [selected]
              - option "Downtown"
              - option "Channel District"
              - option "Hyde Park"
              - option "South Tampa"
              - option "Seminole Heights"
              - option "Ybor City"
              - option "Westshore"
              - option "Carrollwood"
              - option "North Tampa"
      - main [ref=e287]:
        - generic [ref=e288]:
          - link "813 Barbell Save to shortlist Strength & Powerlifting 813 Barbell Seminole Heights · $20 day · Open 24 hours day pass open 24h personal training free parking" [ref=e289] [cursor=pointer]:
            - /url: /gym/813-barbell
            - generic [ref=e290]:
              - img "813 Barbell" [ref=e291]
              - button "Save to shortlist" [ref=e292]:
                - img [ref=e293]
              - generic [ref=e295]: Strength & Powerlifting
            - generic [ref=e296]:
              - heading "813 Barbell" [level=3] [ref=e297]
              - generic [ref=e298]:
                - generic [ref=e299]:
                  - img [ref=e300]
                  - text: Seminole Heights
                - generic [ref=e303]: ·
                - generic [ref=e304]: $20 day
                - generic [ref=e305]: ·
                - generic [ref=e306]:
                  - img [ref=e307]
                  - text: Open 24 hours
              - generic [ref=e310]:
                - generic [ref=e311]: day pass
                - generic [ref=e312]: open 24h
                - generic [ref=e313]: personal training
                - generic [ref=e314]: free parking
          - link "9Round Fitness - Tampa Henderson Blvd Save to shortlist Boutique Studio 9Round Fitness - Tampa Henderson Blvd South Tampa classes free parking day pass personal training" [ref=e315] [cursor=pointer]:
            - /url: /gym/9round-fitness-tampa-henderson-blvd
            - generic [ref=e316]:
              - img "9Round Fitness - Tampa Henderson Blvd" [ref=e317]
              - button "Save to shortlist" [ref=e318]:
                - img [ref=e319]
              - generic [ref=e321]: Boutique Studio
            - generic [ref=e322]:
              - heading "9Round Fitness - Tampa Henderson Blvd" [level=3] [ref=e323]
              - generic [ref=e325]:
                - img [ref=e326]
                - text: South Tampa
              - generic [ref=e329]:
                - generic [ref=e330]: classes
                - generic [ref=e331]: free parking
                - generic [ref=e332]: day pass
                - generic [ref=e333]: personal training
          - link "Amped Fitness Carrollwood Save to shortlist Big Box Amped Fitness Carrollwood Carrollwood · Open 24 hours womens area sauna recovery room classes" [ref=e334] [cursor=pointer]:
            - /url: /gym/amped-fitness-carrollwood
            - generic [ref=e335]:
              - img "Amped Fitness Carrollwood" [ref=e336]
              - button "Save to shortlist" [ref=e337]:
                - img [ref=e338]
              - generic [ref=e340]: Big Box
            - generic [ref=e341]:
              - heading "Amped Fitness Carrollwood" [level=3] [ref=e342]
              - generic [ref=e343]:
                - generic [ref=e344]:
                  - img [ref=e345]
                  - text: Carrollwood
                - generic [ref=e348]: ·
                - generic [ref=e349]:
                  - img [ref=e350]
                  - text: Open 24 hours
              - generic [ref=e353]:
                - generic [ref=e354]: womens area
                - generic [ref=e355]: sauna
                - generic [ref=e356]: recovery room
                - generic [ref=e357]: classes
          - link "Anytime Fitness - Carrollwood Save to shortlist Big Box Anytime Fitness - Carrollwood Carrollwood · Open 24 hours showers personal training wifi classes" [ref=e358] [cursor=pointer]:
            - /url: /gym/anytime-fitness-carrollwood
            - generic [ref=e359]:
              - img "Anytime Fitness - Carrollwood" [ref=e360]
              - button "Save to shortlist" [ref=e361]:
                - img [ref=e362]
              - generic [ref=e364]: Big Box
            - generic [ref=e365]:
              - heading "Anytime Fitness - Carrollwood" [level=3] [ref=e366]
              - generic [ref=e367]:
                - generic [ref=e368]:
                  - img [ref=e369]
                  - text: Carrollwood
                - generic [ref=e372]: ·
                - generic [ref=e373]:
                  - img [ref=e374]
                  - text: Open 24 hours
              - generic [ref=e377]:
                - generic [ref=e378]: showers
                - generic [ref=e379]: personal training
                - generic [ref=e380]: wifi
                - generic [ref=e381]: classes
          - link "Bayshore Fit Save to shortlist Boutique Studio Bayshore Fit South Tampa · $30 day · Open · closes 8:30 PM sauna recovery room classes personal training" [ref=e382] [cursor=pointer]:
            - /url: /gym/bayshore-fit
            - generic [ref=e383]:
              - img "Bayshore Fit" [ref=e384]
              - button "Save to shortlist" [ref=e385]:
                - img [ref=e386]
              - generic [ref=e388]: Boutique Studio
            - generic [ref=e389]:
              - heading "Bayshore Fit" [level=3] [ref=e390]
              - generic [ref=e391]:
                - generic [ref=e392]:
                  - img [ref=e393]
                  - text: South Tampa
                - generic [ref=e396]: ·
                - generic [ref=e397]: $30 day
                - generic [ref=e398]: ·
                - generic [ref=e399]:
                  - img [ref=e400]
                  - text: Open · closes 8:30 PM
              - generic [ref=e403]:
                - generic [ref=e404]: sauna
                - generic [ref=e405]: recovery room
                - generic [ref=e406]: classes
                - generic [ref=e407]: personal training
          - link "Bella Prana Yoga & Meditation Save to shortlist Yoga & Pilates Bella Prana Yoga & Meditation Hyde Park · $25 day · Open · closes 9 PM showers towel service day pass free parking" [ref=e408] [cursor=pointer]:
            - /url: /gym/bella-prana-yoga-and-meditation
            - generic [ref=e409]:
              - img "Bella Prana Yoga & Meditation" [ref=e410]
              - button "Save to shortlist" [ref=e411]:
                - img [ref=e412]
              - generic [ref=e414]: Yoga & Pilates
            - generic [ref=e415]:
              - heading "Bella Prana Yoga & Meditation" [level=3] [ref=e416]
              - generic [ref=e417]:
                - generic [ref=e418]:
                  - img [ref=e419]
                  - text: Hyde Park
                - generic [ref=e422]: ·
                - generic [ref=e423]: $25 day
                - generic [ref=e424]: ·
                - generic [ref=e425]:
                  - img [ref=e426]
                  - text: Open · closes 9 PM
              - generic [ref=e429]:
                - generic [ref=e430]: showers
                - generic [ref=e431]: towel service
                - generic [ref=e432]: day pass
                - generic [ref=e433]: free parking
          - link "CAMP Tampa Save to shortlist Boutique Studio CAMP Tampa South Tampa · Closes soon · 8:05 PM showers lockers parking classes" [ref=e434] [cursor=pointer]:
            - /url: /gym/camp-tampa
            - generic [ref=e435]:
              - img "CAMP Tampa" [ref=e436]
              - button "Save to shortlist" [ref=e437]:
                - img [ref=e438]
              - generic [ref=e440]: Boutique Studio
            - generic [ref=e441]:
              - heading "CAMP Tampa" [level=3] [ref=e442]
              - generic [ref=e443]:
                - generic [ref=e444]:
                  - img [ref=e445]
                  - text: South Tampa
                - generic [ref=e448]: ·
                - generic [ref=e449]:
                  - img [ref=e450]
                  - text: Closes soon · 8:05 PM
              - generic [ref=e453]:
                - generic [ref=e454]: showers
                - generic [ref=e455]: lockers
                - generic [ref=e456]: parking
                - generic [ref=e457]: classes
          - link "Central Rock Gym - Citrus Park Save to shortlist Climbing Central Rock Gym - Citrus Park Carrollwood · $25 day · Open · closes 10 PM sauna showers day pass classes" [ref=e458] [cursor=pointer]:
            - /url: /gym/central-rock-gym-citrus-park
            - generic [ref=e459]:
              - img "Central Rock Gym - Citrus Park" [ref=e460]
              - button "Save to shortlist" [ref=e461]:
                - img [ref=e462]
              - generic [ref=e464]: Climbing
            - generic [ref=e465]:
              - heading "Central Rock Gym - Citrus Park" [level=3] [ref=e466]
              - generic [ref=e467]:
                - generic [ref=e468]:
                  - img [ref=e469]
                  - text: Carrollwood
                - generic [ref=e472]: ·
                - generic [ref=e473]: $25 day
                - generic [ref=e474]: ·
                - generic [ref=e475]:
                  - img [ref=e476]
                  - text: Open · closes 10 PM
              - generic [ref=e479]:
                - generic [ref=e480]: sauna
                - generic [ref=e481]: showers
                - generic [ref=e482]: day pass
                - generic [ref=e483]: classes
          - link "Central Rock Gym - Tampa Save to shortlist Climbing Central Rock Gym - Tampa South Tampa · $25 day · Open · closes 10 PM free parking showers day pass classes" [ref=e484] [cursor=pointer]:
            - /url: /gym/central-rock-gym-tampa
            - generic [ref=e485]:
              - img "Central Rock Gym - Tampa" [ref=e486]
              - button "Save to shortlist" [ref=e487]:
                - img [ref=e488]
              - generic [ref=e490]: Climbing
            - generic [ref=e491]:
              - heading "Central Rock Gym - Tampa" [level=3] [ref=e492]
              - generic [ref=e493]:
                - generic [ref=e494]:
                  - img [ref=e495]
                  - text: South Tampa
                - generic [ref=e498]: ·
                - generic [ref=e499]: $25 day
                - generic [ref=e500]: ·
                - generic [ref=e501]:
                  - img [ref=e502]
                  - text: Open · closes 10 PM
              - generic [ref=e505]:
                - generic [ref=e506]: free parking
                - generic [ref=e507]: showers
                - generic [ref=e508]: day pass
                - generic [ref=e509]: classes
          - link "Club Pilates South Tampa Save to shortlist Yoga & Pilates Club Pilates South Tampa Hyde Park · Closes soon · 8 PM day pass classes" [ref=e510] [cursor=pointer]:
            - /url: /gym/club-pilates-south-tampa
            - generic [ref=e511]:
              - img "Club Pilates South Tampa" [ref=e512]
              - button "Save to shortlist" [ref=e513]:
                - img [ref=e514]
              - generic [ref=e516]: Yoga & Pilates
            - generic [ref=e517]:
              - heading "Club Pilates South Tampa" [level=3] [ref=e518]
              - generic [ref=e519]:
                - generic [ref=e520]:
                  - img [ref=e521]
                  - text: Hyde Park
                - generic [ref=e524]: ·
                - generic [ref=e525]:
                  - img [ref=e526]
                  - text: Closes soon · 8 PM
              - generic [ref=e529]:
                - generic [ref=e530]: day pass
                - generic [ref=e531]: classes
          - link "CrossFit Jaguar Save to shortlist CrossFit CrossFit Jaguar Carrollwood · $20 day classes showers day pass personal training" [ref=e532] [cursor=pointer]:
            - /url: /gym/crossfit-jaguar
            - generic [ref=e533]:
              - img "CrossFit Jaguar" [ref=e534]
              - button "Save to shortlist" [ref=e535]:
                - img [ref=e536]
              - generic [ref=e538]: CrossFit
            - generic [ref=e539]:
              - heading "CrossFit Jaguar" [level=3] [ref=e540]
              - generic [ref=e541]:
                - generic [ref=e542]:
                  - img [ref=e543]
                  - text: Carrollwood
                - generic [ref=e546]: ·
                - generic [ref=e547]: $20 day
              - generic [ref=e548]:
                - generic [ref=e549]: classes
                - generic [ref=e550]: showers
                - generic [ref=e551]: day pass
                - generic [ref=e552]: personal training
          - link "Crunch Fitness - Carrollwood Save to shortlist Big Box Crunch Fitness - Carrollwood Carrollwood · Open · closes 11 PM cardio zone lockers recovery room free parking" [ref=e553] [cursor=pointer]:
            - /url: /gym/crunch-fitness-carrollwood
            - generic [ref=e554]:
              - img "Crunch Fitness - Carrollwood" [ref=e555]
              - button "Save to shortlist" [ref=e556]:
                - img [ref=e557]
              - generic [ref=e559]: Big Box
            - generic [ref=e560]:
              - heading "Crunch Fitness - Carrollwood" [level=3] [ref=e561]
              - generic [ref=e562]:
                - generic [ref=e563]:
                  - img [ref=e564]
                  - text: Carrollwood
                - generic [ref=e567]: ·
                - generic [ref=e568]:
                  - img [ref=e569]
                  - text: Open · closes 11 PM
              - generic [ref=e572]:
                - generic [ref=e573]: cardio zone
                - generic [ref=e574]: lockers
                - generic [ref=e575]: recovery room
                - generic [ref=e576]: free parking
          - link "Crunch Fitness - South Tampa Save to shortlist Big Box Crunch Fitness - South Tampa South Tampa · Open · closes 11 PM cardio zone classes personal training lockers" [ref=e577] [cursor=pointer]:
            - /url: /gym/crunch-fitness-south-tampa
            - generic [ref=e578]:
              - img "Crunch Fitness - South Tampa" [ref=e579]
              - button "Save to shortlist" [ref=e580]:
                - img [ref=e581]
              - generic [ref=e583]: Big Box
            - generic [ref=e584]:
              - heading "Crunch Fitness - South Tampa" [level=3] [ref=e585]
              - generic [ref=e586]:
                - generic [ref=e587]:
                  - img [ref=e588]
                  - text: South Tampa
                - generic [ref=e591]: ·
                - generic [ref=e592]:
                  - img [ref=e593]
                  - text: Open · closes 11 PM
              - generic [ref=e596]:
                - generic [ref=e597]: cardio zone
                - generic [ref=e598]: classes
                - generic [ref=e599]: personal training
                - generic [ref=e600]: lockers
          - link "Save to shortlist CrossFit Dale Mabry CrossFit South Tampa · Closed for today free parking personal training classes" [ref=e601] [cursor=pointer]:
            - /url: /gym/dale-mabry-crossfit
            - generic [ref=e602]:
              - img [ref=e604]
              - button "Save to shortlist" [ref=e612]:
                - img [ref=e613]
              - generic [ref=e615]: CrossFit
            - generic [ref=e616]:
              - heading "Dale Mabry CrossFit" [level=3] [ref=e617]
              - generic [ref=e618]:
                - generic [ref=e619]:
                  - img [ref=e620]
                  - text: South Tampa
                - generic [ref=e623]: ·
                - generic [ref=e624]:
                  - img [ref=e625]
                  - text: Closed for today
              - generic [ref=e628]:
                - generic [ref=e629]: free parking
                - generic [ref=e630]: personal training
                - generic [ref=e631]: classes
          - link "EoS Fitness Tampa Midtown Save to shortlist Big Box EoS Fitness Tampa Midtown Westshore · Open 24 hours pool basketball court recovery room childcare" [ref=e632] [cursor=pointer]:
            - /url: /gym/eos-fitness-tampa-midtown
            - generic [ref=e633]:
              - img "EoS Fitness Tampa Midtown" [ref=e634]
              - button "Save to shortlist" [ref=e635]:
                - img [ref=e636]
              - generic [ref=e638]: Big Box
            - generic [ref=e639]:
              - heading "EoS Fitness Tampa Midtown" [level=3] [ref=e640]
              - generic [ref=e641]:
                - generic [ref=e642]:
                  - img [ref=e643]
                  - text: Westshore
                - generic [ref=e646]: ·
                - generic [ref=e647]:
                  - img [ref=e648]
                  - text: Open 24 hours
              - generic [ref=e651]:
                - generic [ref=e652]: pool
                - generic [ref=e653]: basketball court
                - generic [ref=e654]: recovery room
                - generic [ref=e655]: childcare
          - link "F45 Training Sparkman Tampa Save to shortlist Boutique Studio F45 Training Sparkman Tampa Downtown parking day pass classes" [ref=e656] [cursor=pointer]:
            - /url: /gym/f45-training-sparkman-tampa
            - generic [ref=e657]:
              - img "F45 Training Sparkman Tampa" [ref=e658]
              - button "Save to shortlist" [ref=e659]:
                - img [ref=e660]
              - generic [ref=e662]: Boutique Studio
            - generic [ref=e663]:
              - heading "F45 Training Sparkman Tampa" [level=3] [ref=e664]
              - generic [ref=e666]:
                - img [ref=e667]
                - text: Downtown
              - generic [ref=e670]:
                - generic [ref=e671]: parking
                - generic [ref=e672]: day pass
                - generic [ref=e673]: classes
          - link "Fox Fitness Save to shortlist Boutique Studio Fox Fitness South Tampa womens only classes personal training" [ref=e674] [cursor=pointer]:
            - /url: /gym/fox-fitness-south-tampa
            - generic [ref=e675]:
              - img "Fox Fitness" [ref=e676]
              - button "Save to shortlist" [ref=e677]:
                - img [ref=e678]
              - generic [ref=e680]: Boutique Studio
            - generic [ref=e681]:
              - heading "Fox Fitness" [level=3] [ref=e682]
              - generic [ref=e684]:
                - img [ref=e685]
                - text: South Tampa
              - generic [ref=e688]:
                - generic [ref=e689]: womens only
                - generic [ref=e690]: classes
                - generic [ref=e691]: personal training
          - link "Gracie Tampa South MMA Save to shortlist MMA & Boxing Gracie Tampa South MMA Hyde Park · Open · closes 9 PM parking personal training classes" [ref=e692] [cursor=pointer]:
            - /url: /gym/gracie-tampa-south-mma
            - generic [ref=e693]:
              - img "Gracie Tampa South MMA" [ref=e694]
              - button "Save to shortlist" [ref=e695]:
                - img [ref=e696]
              - generic [ref=e698]: MMA & Boxing
            - generic [ref=e699]:
              - heading "Gracie Tampa South MMA" [level=3] [ref=e700]
              - generic [ref=e701]:
                - generic [ref=e702]:
                  - img [ref=e703]
                  - text: Hyde Park
                - generic [ref=e706]: ·
                - generic [ref=e707]:
                  - img [ref=e708]
                  - text: Open · closes 9 PM
              - generic [ref=e711]:
                - generic [ref=e712]: parking
                - generic [ref=e713]: personal training
                - generic [ref=e714]: classes
          - link "Kodawari Studios Save to shortlist Yoga & Pilates Kodawari Studios South Tampa · $22 day · Closed for today cold plunge classes showers towel service" [ref=e715] [cursor=pointer]:
            - /url: /gym/kodawari-studios
            - generic [ref=e716]:
              - img "Kodawari Studios" [ref=e717]
              - button "Save to shortlist" [ref=e718]:
                - img [ref=e719]
              - generic [ref=e721]: Yoga & Pilates
            - generic [ref=e722]:
              - heading "Kodawari Studios" [level=3] [ref=e723]
              - generic [ref=e724]:
                - generic [ref=e725]:
                  - img [ref=e726]
                  - text: South Tampa
                - generic [ref=e729]: ·
                - generic [ref=e730]: $22 day
                - generic [ref=e731]: ·
                - generic [ref=e732]:
                  - img [ref=e733]
                  - text: Closed for today
              - generic [ref=e736]:
                - generic [ref=e737]: cold plunge
                - generic [ref=e738]: classes
                - generic [ref=e739]: showers
                - generic [ref=e740]: towel service
          - link "LA Fitness - Tampa S Dale Mabry (Signature) Save to shortlist Big Box LA Fitness - Tampa S Dale Mabry (Signature) South Tampa · Open · closes 11 PM personal training childcare towel service wifi" [ref=e741] [cursor=pointer]:
            - /url: /gym/la-fitness-tampa-s-dale-mabry-signature
            - generic [ref=e742]:
              - img "LA Fitness - Tampa S Dale Mabry (Signature)" [ref=e743]
              - button "Save to shortlist" [ref=e744]:
                - img [ref=e745]
              - generic [ref=e747]: Big Box
            - generic [ref=e748]:
              - heading "LA Fitness - Tampa S Dale Mabry (Signature)" [level=3] [ref=e749]
              - generic [ref=e750]:
                - generic [ref=e751]:
                  - img [ref=e752]
                  - text: South Tampa
                - generic [ref=e755]: ·
                - generic [ref=e756]:
                  - img [ref=e757]
                  - text: Open · closes 11 PM
              - generic [ref=e760]:
                - generic [ref=e761]: personal training
                - generic [ref=e762]: childcare
                - generic [ref=e763]: towel service
                - generic [ref=e764]: wifi
          - link "Life Time Harbour Island Save to shortlist Luxury Club Life Time Harbour Island Downtown · Open · closes midnight steam room towel service showers pool" [ref=e765] [cursor=pointer]:
            - /url: /gym/life-time-harbour-island
            - generic [ref=e766]:
              - img "Life Time Harbour Island" [ref=e767]
              - button "Save to shortlist" [ref=e768]:
                - img [ref=e769]
              - generic [ref=e771]: Luxury Club
            - generic [ref=e772]:
              - heading "Life Time Harbour Island" [level=3] [ref=e773]
              - generic [ref=e774]:
                - generic [ref=e775]:
                  - img [ref=e776]
                  - text: Downtown
                - generic [ref=e779]: ·
                - generic [ref=e780]:
                  - img [ref=e781]
                  - text: Open · closes midnight
              - generic [ref=e784]:
                - generic [ref=e785]: steam room
                - generic [ref=e786]: towel service
                - generic [ref=e787]: showers
                - generic [ref=e788]: pool
          - link "MADabolic Ybor City Save to shortlist Boutique Studio MADabolic Ybor City Ybor City · $35 day · Closed for today turf area classes day pass" [ref=e789] [cursor=pointer]:
            - /url: /gym/madabolic-ybor-city
            - generic [ref=e790]:
              - img "MADabolic Ybor City" [ref=e791]
              - button "Save to shortlist" [ref=e792]:
                - img [ref=e793]
              - generic [ref=e795]: Boutique Studio
            - generic [ref=e796]:
              - heading "MADabolic Ybor City" [level=3] [ref=e797]
              - generic [ref=e798]:
                - generic [ref=e799]:
                  - img [ref=e800]
                  - text: Ybor City
                - generic [ref=e803]: ·
                - generic [ref=e804]: $35 day
                - generic [ref=e805]: ·
                - generic [ref=e806]:
                  - img [ref=e807]
                  - text: Closed for today
              - generic [ref=e810]:
                - generic [ref=e811]: turf area
                - generic [ref=e812]: classes
                - generic [ref=e813]: day pass
          - link "NOEQL Training Co. Save to shortlist CrossFit NOEQL Training Co. Ybor City · Closes soon · 8 PM classes personal training day pass" [ref=e814] [cursor=pointer]:
            - /url: /gym/cigar-city-crossfit
            - generic [ref=e815]:
              - img "NOEQL Training Co." [ref=e816]
              - button "Save to shortlist" [ref=e817]:
                - img [ref=e818]
              - generic [ref=e820]: CrossFit
            - generic [ref=e821]:
              - heading "NOEQL Training Co." [level=3] [ref=e822]
              - generic [ref=e823]:
                - generic [ref=e824]:
                  - img [ref=e825]
                  - text: Ybor City
                - generic [ref=e828]: ·
                - generic [ref=e829]:
                  - img [ref=e830]
                  - text: Closes soon · 8 PM
              - generic [ref=e833]:
                - generic [ref=e834]: classes
                - generic [ref=e835]: personal training
                - generic [ref=e836]: day pass
          - link "Orangetheory Fitness - South Tampa Save to shortlist Boutique Studio Orangetheory Fitness - South Tampa South Tampa classes showers day pass free parking" [ref=e837] [cursor=pointer]:
            - /url: /gym/orangetheory-fitness-south-tampa
            - generic [ref=e838]:
              - img "Orangetheory Fitness - South Tampa" [ref=e839]
              - button "Save to shortlist" [ref=e840]:
                - img [ref=e841]
              - generic [ref=e843]: Boutique Studio
            - generic [ref=e844]:
              - heading "Orangetheory Fitness - South Tampa" [level=3] [ref=e845]
              - generic [ref=e847]:
                - img [ref=e848]
                - text: South Tampa
              - generic [ref=e851]:
                - generic [ref=e852]: classes
                - generic [ref=e853]: showers
                - generic [ref=e854]: day pass
                - generic [ref=e855]: free parking
          - link "Orangetheory Fitness - Water Street Tampa Save to shortlist Boutique Studio Orangetheory Fitness - Water Street Tampa Downtown showers day pass classes parking" [ref=e856] [cursor=pointer]:
            - /url: /gym/orangetheory-fitness-water-street-tampa
            - generic [ref=e857]:
              - img "Orangetheory Fitness - Water Street Tampa" [ref=e858]
              - button "Save to shortlist" [ref=e859]:
                - img [ref=e860]
              - generic [ref=e862]: Boutique Studio
            - generic [ref=e863]:
              - heading "Orangetheory Fitness - Water Street Tampa" [level=3] [ref=e864]
              - generic [ref=e866]:
                - img [ref=e867]
                - text: Downtown
              - generic [ref=e870]:
                - generic [ref=e871]: showers
                - generic [ref=e872]: day pass
                - generic [ref=e873]: classes
                - generic [ref=e874]: parking
          - link "Peach Lab Save to shortlist Boutique Studio Peach Lab South Tampa womens only classes personal training" [ref=e875] [cursor=pointer]:
            - /url: /gym/peach-lab-tampa
            - generic [ref=e876]:
              - img "Peach Lab" [ref=e877]
              - button "Save to shortlist" [ref=e878]:
                - img [ref=e879]
              - generic [ref=e881]: Boutique Studio
            - generic [ref=e882]:
              - heading "Peach Lab" [level=3] [ref=e883]
              - generic [ref=e885]:
                - img [ref=e886]
                - text: South Tampa
              - generic [ref=e889]:
                - generic [ref=e890]: womens only
                - generic [ref=e891]: classes
                - generic [ref=e892]: personal training
          - link "Perspire Sauna Studio - South Tampa Save to shortlist Recovery Perspire Sauna Studio - South Tampa South Tampa · $60 day · Open · closes 9 PM cold plunge showers towel service sauna" [ref=e893] [cursor=pointer]:
            - /url: /gym/perspire-sauna-studio-south-tampa
            - generic [ref=e894]:
              - img "Perspire Sauna Studio - South Tampa" [ref=e895]
              - button "Save to shortlist" [ref=e896]:
                - img [ref=e897]
              - generic [ref=e899]: Recovery
            - generic [ref=e900]:
              - heading "Perspire Sauna Studio - South Tampa" [level=3] [ref=e901]
              - generic [ref=e902]:
                - generic [ref=e903]:
                  - img [ref=e904]
                  - text: South Tampa
                - generic [ref=e907]: ·
                - generic [ref=e908]: $60 day
                - generic [ref=e909]: ·
                - generic [ref=e910]:
                  - img [ref=e911]
                  - text: Open · closes 9 PM
              - generic [ref=e914]:
                - generic [ref=e915]: cold plunge
                - generic [ref=e916]: showers
                - generic [ref=e917]: towel service
                - generic [ref=e918]: sauna
          - link "Planet Fitness - Tampa (Fowler Ave) Save to shortlist Big Box Planet Fitness - Tampa (Fowler Ave) North Tampa · Open 24 hours showers open 24h free parking classes" [ref=e919] [cursor=pointer]:
            - /url: /gym/planet-fitness-tampa-fowler-ave
            - generic [ref=e920]:
              - img "Planet Fitness - Tampa (Fowler Ave)" [ref=e921]
              - button "Save to shortlist" [ref=e922]:
                - img [ref=e923]
              - generic [ref=e925]: Big Box
            - generic [ref=e926]:
              - heading "Planet Fitness - Tampa (Fowler Ave)" [level=3] [ref=e927]
              - generic [ref=e928]:
                - generic [ref=e929]:
                  - img [ref=e930]
                  - text: North Tampa
                - generic [ref=e933]: ·
                - generic [ref=e934]:
                  - img [ref=e935]
                  - text: Open 24 hours
              - generic [ref=e938]:
                - generic [ref=e939]: showers
                - generic [ref=e940]: open 24h
                - generic [ref=e941]: free parking
                - generic [ref=e942]: classes
          - link "Powerhouse Gym Athletic Club Save to shortlist Strength & Powerlifting Powerhouse Gym Athletic Club Carrollwood · $20 day · Open · closes midnight sauna recovery room cardio zone lockers" [ref=e943] [cursor=pointer]:
            - /url: /gym/powerhouse-gym-athletic-club
            - generic [ref=e944]:
              - img "Powerhouse Gym Athletic Club" [ref=e945]
              - button "Save to shortlist" [ref=e946]:
                - img [ref=e947]
              - generic [ref=e949]: Strength & Powerlifting
            - generic [ref=e950]:
              - heading "Powerhouse Gym Athletic Club" [level=3] [ref=e951]
              - generic [ref=e952]:
                - generic [ref=e953]:
                  - img [ref=e954]
                  - text: Carrollwood
                - generic [ref=e957]: ·
                - generic [ref=e958]: $20 day
                - generic [ref=e959]: ·
                - generic [ref=e960]:
                  - img [ref=e961]
                  - text: Open · closes midnight
              - generic [ref=e964]:
                - generic [ref=e965]: sauna
                - generic [ref=e966]: recovery room
                - generic [ref=e967]: cardio zone
                - generic [ref=e968]: lockers
          - link "Powerhouse Gym North Tampa Save to shortlist Strength & Powerlifting Powerhouse Gym North Tampa North Tampa · $15 day · Open 24 hours day pass cardio zone free parking personal training" [ref=e969] [cursor=pointer]:
            - /url: /gym/powerhouse-gym-north-tampa
            - generic [ref=e970]:
              - img "Powerhouse Gym North Tampa" [ref=e971]
              - button "Save to shortlist" [ref=e972]:
                - img [ref=e973]
              - generic [ref=e975]: Strength & Powerlifting
            - generic [ref=e976]:
              - heading "Powerhouse Gym North Tampa" [level=3] [ref=e977]
              - generic [ref=e978]:
                - generic [ref=e979]:
                  - img [ref=e980]
                  - text: North Tampa
                - generic [ref=e983]: ·
                - generic [ref=e984]: $15 day
                - generic [ref=e985]: ·
                - generic [ref=e986]:
                  - img [ref=e987]
                  - text: Open 24 hours
              - generic [ref=e990]:
                - generic [ref=e991]: day pass
                - generic [ref=e992]: cardio zone
                - generic [ref=e993]: free parking
                - generic [ref=e994]: personal training
          - link "Restore Hyper Wellness - Carrollwood Save to shortlist Recovery Restore Hyper Wellness - Carrollwood Carrollwood · $42 day · Closed for today recovery room day pass sauna free parking" [ref=e995] [cursor=pointer]:
            - /url: /gym/restore-hyper-wellness-carrollwood
            - generic [ref=e996]:
              - img "Restore Hyper Wellness - Carrollwood" [ref=e997]
              - button "Save to shortlist" [ref=e998]:
                - img [ref=e999]
              - generic [ref=e1001]: Recovery
            - generic [ref=e1002]:
              - heading "Restore Hyper Wellness - Carrollwood" [level=3] [ref=e1003]
              - generic [ref=e1004]:
                - generic [ref=e1005]:
                  - img [ref=e1006]
                  - text: Carrollwood
                - generic [ref=e1009]: ·
                - generic [ref=e1010]: $42 day
                - generic [ref=e1011]: ·
                - generic [ref=e1012]:
                  - img [ref=e1013]
                  - text: Closed for today
              - generic [ref=e1016]:
                - generic [ref=e1017]: recovery room
                - generic [ref=e1018]: day pass
                - generic [ref=e1019]: sauna
                - generic [ref=e1020]: free parking
          - link "Seminole Heights CrossFit Save to shortlist CrossFit Seminole Heights CrossFit Seminole Heights · $25 day · Closed for today day pass classes personal training free parking" [ref=e1021] [cursor=pointer]:
            - /url: /gym/seminole-heights-crossfit
            - generic [ref=e1022]:
              - img "Seminole Heights CrossFit" [ref=e1023]
              - button "Save to shortlist" [ref=e1024]:
                - img [ref=e1025]
              - generic [ref=e1027]: CrossFit
            - generic [ref=e1028]:
              - heading "Seminole Heights CrossFit" [level=3] [ref=e1029]
              - generic [ref=e1030]:
                - generic [ref=e1031]:
                  - img [ref=e1032]
                  - text: Seminole Heights
                - generic [ref=e1035]: ·
                - generic [ref=e1036]: $25 day
                - generic [ref=e1037]: ·
                - generic [ref=e1038]:
                  - img [ref=e1039]
                  - text: Closed for today
              - generic [ref=e1042]:
                - generic [ref=e1043]: day pass
                - generic [ref=e1044]: classes
                - generic [ref=e1045]: personal training
                - generic [ref=e1046]: free parking
          - link "solidcore Hyde Park Save to shortlist Yoga & Pilates solidcore Hyde Park Hyde Park free parking classes" [ref=e1047] [cursor=pointer]:
            - /url: /gym/solidcore-hyde-park
            - generic [ref=e1048]:
              - img "solidcore Hyde Park" [ref=e1049]
              - button "Save to shortlist" [ref=e1050]:
                - img [ref=e1051]
              - generic [ref=e1053]: Yoga & Pilates
            - generic [ref=e1054]:
              - heading "solidcore Hyde Park" [level=3] [ref=e1055]
              - generic [ref=e1057]:
                - img [ref=e1058]
                - text: Hyde Park
              - generic [ref=e1061]:
                - generic [ref=e1062]: free parking
                - generic [ref=e1063]: classes
          - link "Tampa Muay Thai Save to shortlist MMA & Boxing Tampa Muay Thai Ybor City · $25 day · Open · closes 9 PM classes personal training day pass parking" [ref=e1064] [cursor=pointer]:
            - /url: /gym/tampa-muay-thai
            - generic [ref=e1065]:
              - img "Tampa Muay Thai" [ref=e1066]
              - button "Save to shortlist" [ref=e1067]:
                - img [ref=e1068]
              - generic [ref=e1070]: MMA & Boxing
            - generic [ref=e1071]:
              - heading "Tampa Muay Thai" [level=3] [ref=e1072]
              - generic [ref=e1073]:
                - generic [ref=e1074]:
                  - img [ref=e1075]
                  - text: Ybor City
                - generic [ref=e1078]: ·
                - generic [ref=e1079]: $25 day
                - generic [ref=e1080]: ·
                - generic [ref=e1081]:
                  - img [ref=e1082]
                  - text: Open · closes 9 PM
              - generic [ref=e1085]:
                - generic [ref=e1086]: classes
                - generic [ref=e1087]: personal training
                - generic [ref=e1088]: day pass
                - generic [ref=e1089]: parking
          - link "Westshore CrossFit Save to shortlist CrossFit Westshore CrossFit Westshore · Closes soon · 7:30 PM classes personal training day pass parking" [ref=e1090] [cursor=pointer]:
            - /url: /gym/westshore-crossfit
            - generic [ref=e1091]:
              - img "Westshore CrossFit" [ref=e1092]
              - button "Save to shortlist" [ref=e1093]:
                - img [ref=e1094]
              - generic [ref=e1096]: CrossFit
            - generic [ref=e1097]:
              - heading "Westshore CrossFit" [level=3] [ref=e1098]
              - generic [ref=e1099]:
                - generic [ref=e1100]:
                  - img [ref=e1101]
                  - text: Westshore
                - generic [ref=e1104]: ·
                - generic [ref=e1105]:
                  - img [ref=e1106]
                  - text: Closes soon · 7:30 PM
              - generic [ref=e1109]:
                - generic [ref=e1110]: classes
                - generic [ref=e1111]: personal training
                - generic [ref=e1112]: day pass
                - generic [ref=e1113]: parking
  - contentinfo [ref=e1114]:
    - generic [ref=e1115]:
      - generic [ref=e1116]:
        - generic [ref=e1117]:
          - generic [ref=e1118]:
            - img [ref=e1119]
            - generic [ref=e1131]: Scout
          - paragraph [ref=e1132]: AI-powered gym discovery. Honest data, explainable matches — the equipment, amenities, and hours that actually matter.
          - paragraph [ref=e1133]: Find your fit.
        - generic [ref=e1134]:
          - generic [ref=e1135]:
            - heading "Scout" [level=3] [ref=e1136]
            - list [ref=e1137]:
              - listitem [ref=e1138]:
                - link "Explore" [ref=e1139] [cursor=pointer]:
                  - /url: /
              - listitem [ref=e1140]:
                - link "Trips" [ref=e1141] [cursor=pointer]:
                  - /url: /trips
              - listitem [ref=e1142]:
                - link "Compare" [ref=e1143] [cursor=pointer]:
                  - /url: /compare
              - listitem [ref=e1144]:
                - link "How our data works" [ref=e1145] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e1146]:
                - link "Field notes" [ref=e1147] [cursor=pointer]:
                  - /url: /blog
          - generic [ref=e1148]:
            - heading "Beta" [level=3] [ref=e1149]
            - list [ref=e1150]:
              - listitem [ref=e1151]:
                - link "Send feedback" [ref=e1152] [cursor=pointer]:
                  - /url: mailto:zchasse89@gmail.com?subject=Scout%20feedback
              - listitem [ref=e1153]:
                - link "Want your city next?" [ref=e1154] [cursor=pointer]:
                  - /url: mailto:zchasse89@gmail.com?subject=Bring%20Scout%20to%20my%20city
              - listitem [ref=e1155]:
                - paragraph [ref=e1156]: Gym alerts
                - generic [ref=e1157]:
                  - generic [ref=e1158]:
                    - generic [ref=e1159] [cursor=pointer]:
                      - checkbox "New gyms" [checked] [ref=e1160]
                      - text: New gyms
                    - generic [ref=e1161] [cursor=pointer]:
                      - checkbox "Changes at gyms" [checked] [ref=e1162]
                      - text: Changes at gyms
                  - generic [ref=e1163]:
                    - textbox "Email for gym alerts" [ref=e1164]:
                      - /placeholder: you@example.com
                    - button "Subscribe" [disabled] [ref=e1165]:
                      - img [ref=e1166]
                      - text: Alerts
      - generic [ref=e1169]:
        - paragraph [ref=e1170]: Tampa quadrant · 27.9506° N · 82.4572° W
        - paragraph [ref=e1171]:
          - link "Privacy" [ref=e1172] [cursor=pointer]:
            - /url: /privacy
          - link "Terms" [ref=e1173] [cursor=pointer]:
            - /url: /terms
          - generic [ref=e1174]: © 2026 Scout · Tampa beta
  - button "Open Next.js Dev Tools" [ref=e1180] [cursor=pointer]:
    - img [ref=e1181]
  - alert [ref=e1184]
```

# Test source

```ts
  1   | import type { Locator, Page } from "@playwright/test";
  2   | 
  3   | /**
  4   |  * Page Object Model for the Scout Discovery (home) page.
  5   |  * Covers: NL search bar, example chips, sticky count bar, parse badges,
  6   |  * query chip, view-mode toggle, and overall reset.
  7   |  */
  8   | export class DiscoveryPage {
  9   |   readonly page: Page;
  10  | 
  11  |   // Search form
  12  |   readonly searchInput: Locator;
  13  |   readonly submitButton: Locator;
  14  |   readonly searchForm: Locator;
  15  | 
  16  |   // Sticky count bar
  17  |   readonly stickyBar: Locator;
  18  |   readonly gymCountSpan: Locator;
  19  | 
  20  |   // Parse badges
  21  |   readonly aiParsedBadge: Locator;
  22  |   readonly quickParsedBadge: Locator;
  23  | 
  24  |   // Query chip
  25  |   readonly queryChip: Locator;
  26  |   readonly clearSearchButton: Locator;
  27  | 
  28  |   // View mode toggle
  29  |   readonly viewModeGroup: Locator;
  30  |   readonly listButton: Locator;
  31  |   readonly mapButton: Locator;
  32  | 
  33  |   // Results grid
  34  |   readonly gymCards: Locator;
  35  | 
  36  |   // Weak-match banner
  37  |   readonly weakMatchBanner: Locator;
  38  | 
  39  |   constructor(page: Page) {
  40  |     this.page = page;
  41  | 
  42  |     this.searchInput = page.locator('input[aria-label="Describe your ideal gym"]');
  43  |     this.submitButton = page.getByRole("button", { name: "Scout it" });
  44  |     this.searchForm = page.locator('form[role="search"]');
  45  | 
  46  |     this.stickyBar = page.locator("div.sticky.top-16");
  47  |     this.gymCountSpan = this.stickyBar.locator("span.font-mono.text-xs").first();
  48  | 
  49  |     this.aiParsedBadge = page.getByText("AI-parsed");
  50  |     this.quickParsedBadge = page.getByText("Quick-parsed");
  51  | 
  52  |     this.queryChip = this.stickyBar.locator("span.font-mono").filter({
  53  |       has: page.locator('button[aria-label="Clear search"]'),
  54  |     });
  55  |     this.clearSearchButton = page.locator('button[aria-label="Clear search"]');
  56  | 
  57  |     this.viewModeGroup = page.getByRole("group", { name: "View mode" });
  58  |     this.listButton = this.viewModeGroup.getByRole("button", { name: "List" });
  59  |     this.mapButton = this.viewModeGroup.getByRole("button", { name: "Map" });
  60  | 
  61  |     this.gymCards = page.locator('a[href^="/gym/"]');
  62  | 
  63  |     this.weakMatchBanner = page.locator("div.rounded-xl.border.border-pool\\/30");
  64  |   }
  65  | 
  66  |   /**
  67  |    * Example chips below the search form.
  68  |    * Only rendered when rawQuery === "" (no active search).
  69  |    */
  70  |   exampleChips(): Locator {
  71  |     return this.searchForm.locator("+ div button");
  72  |   }
  73  | 
  74  |   async goto(): Promise<void> {
> 75  |     await this.page.goto("/");
      |                     ^ Error: page.goto: Test timeout of 30000ms exceeded.
  76  |     // Wait for the search input to be present — confirms React has hydrated
  77  |     await this.searchInput.waitFor({ state: "visible" });
  78  |   }
  79  | 
  80  |   /**
  81  |    * Type a query and submit the form.
  82  |    * Awaits parse completion (spinner disappears from submit button).
  83  |    * Uses a 25s timeout to accommodate slow AI edge function responses.
  84  |    */
  85  |   async search(query: string): Promise<void> {
  86  |     await this.searchInput.fill(query);
  87  |     await this.submitButton.click();
  88  |     // Wait for parse to complete: spinner disappears from submit button.
  89  |     // Timeout: 25s — AI edge function can take up to ~10s; fallback is instant.
  90  |     await this.page.waitForFunction(
  91  |       () => {
  92  |         const btn = document.querySelector('button[type="submit"]');
  93  |         return btn && !btn.querySelector(".animate-spin");
  94  |       },
  95  |       undefined,
  96  |       { timeout: 25_000 },
  97  |     );
  98  |   }
  99  | 
  100 |   /** Click one of the example chips by its full text label. */
  101 |   async clickExampleChip(text: string): Promise<void> {
  102 |     await this.page.getByRole("button", { name: text, exact: true }).click();
  103 |     await this.page.waitForFunction(
  104 |       () => {
  105 |         const btn = document.querySelector('button[type="submit"]');
  106 |         return btn && !btn.querySelector(".animate-spin");
  107 |       },
  108 |       undefined,
  109 |       { timeout: 25_000 },
  110 |     );
  111 |   }
  112 | 
  113 |   /** Read the current gym count from the sticky bar (returns the number). */
  114 |   async getGymCount(): Promise<number> {
  115 |     const text = await this.gymCountSpan.textContent();
  116 |     const match = text?.match(/^(\d+)/);
  117 |     return match ? parseInt(match[1], 10) : 0;
  118 |   }
  119 | 
  120 |   /** Check whether the AI-parsed or Quick-parsed badge is visible. */
  121 |   async parseBadgeVisible(): Promise<boolean> {
  122 |     const ai = await this.aiParsedBadge.isVisible();
  123 |     const quick = await this.quickParsedBadge.isVisible();
  124 |     return ai || quick;
  125 |   }
  126 | 
  127 |   async resetViaQueryChip(): Promise<void> {
  128 |     await this.clearSearchButton.click();
  129 |     await this.searchInput.waitFor({ state: "visible" });
  130 |   }
  131 | 
  132 |   async switchToMapView(): Promise<void> {
  133 |     await this.mapButton.click();
  134 |   }
  135 | 
  136 |   async switchToListView(): Promise<void> {
  137 |     await this.listButton.click();
  138 |   }
  139 | }
  140 | 
```