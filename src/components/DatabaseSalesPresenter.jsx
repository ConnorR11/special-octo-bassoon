import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight, LoaderCircle, Maximize2 } from "lucide-react"
import { PDFDocument } from "pdf-lib"
import { supabase } from "../lib/supabase"

const PRESENTER_PATH = "Homeshield-Solar-Presenter-edited.pdf"


function TandemFinanceSlide() {
  const cyan = "#08c7ed"
  const pale = "#e8f1f8"
  const rows = [
    ["Cash Price", "£10,000.00"],
    ["Deposit", "£0.00"],
    ["Amount Of Credit", "£10,000.00"],
    ["Duration of Agreement", "120"],
    ["Interest Rate % (Fixed p.a.)", "3.6%"],
    ["Representative % APR", "3.6%"],
    ["120 Monthly Payments Of", "£99.08"],
    ["Total Amount Payable", "£11,889.60"],
  ]
  const absolute = (left, top, width, height) => ({ position: "absolute", left, top, width, height, boxSizing: "border-box" })
  return <div style={{ width: "min(100%, calc((100vh - 160px) * 16 / 9))", maxWidth: "100%", aspectRatio: "16 / 9", position: "relative", overflow: "hidden", flex: "0 1 auto", background: "radial-gradient(ellipse at 5% 2%, #0879bb 0%, #032a49 30%, #001629 67%, #001222 100%)", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif", boxSizing: "border-box", boxShadow: "0 4px 22px rgba(0,0,0,.25)" }}>
    <div style={{ ...absolute("2.3%", "3.2%", "58%", "5%"), display: "flex", alignItems: "center", gap: "1.2%", fontSize: "clamp(10px, 1.28vw, 21px)", letterSpacing: ".035em", whiteSpace: "nowrap" }}>
      <span style={{ width: "clamp(18px, 2.1vw, 34px)", height: "clamp(18px, 2.1vw, 34px)", borderRadius: 5, background: cyan, flexShrink: 0 }} /> HOMESHIELD SCOTLAND
    </div>
    <div style={{ ...absolute("69%", "3.5%", "27%", "4.5%"), display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "3%", fontSize: "clamp(8px, 1.05vw, 17px)", whiteSpace: "nowrap", letterSpacing: ".025em" }}>
      SOLAR + BATTERY STORAGE <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "clamp(18px, 2vw, 32px)", height: "clamp(18px, 2vw, 32px)", borderRadius: 5, background: "#fff", color: "#09223a", fontWeight: 900 }}>⌂</span>
    </div>
    <div style={{ ...absolute("3.5%", "14%", "52%", "25%"), display: "flex", flexDirection: "column", gap: "2%" }}>
      <div style={{ fontSize: "clamp(24px, 3.35vw, 52px)", lineHeight: 1.04, fontWeight: 800, letterSpacing: "-.035em" }}>Solar &amp; battery finance</div>
      <div style={{ fontSize: "clamp(23px, 3.15vw, 48px)", lineHeight: 1.04, fontWeight: 800, letterSpacing: "-.035em", color: cyan }}>with Government support</div>
      <div style={{ marginTop: "1.5%", fontSize: "clamp(11px, 1.55vw, 24px)", lineHeight: 1.3, color: pale, maxWidth: "94%" }}>A lower interest rate, making renewable energy<br/>more affordable for your home.</div>
    </div>
    <div style={{ ...absolute("3.2%", "42%", "54%", "29.5%"), border: "2px solid "+cyan, borderRadius: 17, background: "#fff", color: "#07101d", display: "grid", gridTemplateColumns: "37% 63%", alignItems: "center", padding: "2.5% 3.5%", gap: "3%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0, height: "100%" }}><img src={"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGkAAABaCAYAAAC7bHg5AAAjpUlEQVR42u2deXRUZbbFNxSWBqIFsSORYDQajB2GjqAggqKxcUIBgafiLA6IojiiOLU4tKLtCDii0jIog4qIih1FECQtAg5gMBoNBqPBQJrYJQWFpe8PfufV4a4AAVtetK21spKa7v2+M+yzz3BvGkgq16/vEZYU5+80SdWSsthLWFKC9xK1fDe0mdfr7aOhfp2PhKQIf0f5Xc3vOO8nAoqxn1/d49espFRJKe61KK+Ft/K9xO9K2nGPGD9hIE8oKR5Qnn6NivktKCnVxaSoU1LE/U7Rb+Txa/YkD2umsDGSdpKUjqJCtcSl35W0gx5RJ/gUfreV9JWkm1CQj0//1cQhzUGNPbICr6U76MneBhjKctAWqQXuqjlenNjUSFKepPMlfS3pZl7PIybFJOW4Y7Tld4o7pleqJPXczJoU2GMq+6xXSmrrBFXNgk0A5byW4T4bQ9CV/F0X5Zc7r4kH4kwUgZaigBxJJY7hTZRUxmeK+U4H/s7neUngnHEHmwmUe7OkQ3gtV1INCrRcLMWRmCr+zvhPK6nBz0hmQwizKgA7KSimg6QH2UBnrHJYIBHd2sMLIcUpOIRiyrDgCpSzv6QvJK2R1E3SHPe9TL5XzmejKD6+GcMx1mhKmsa5ooHPR1BY1HlVtD54UjqWVeUsL4qlVaKk7yW1kHSnpNeAihPrCAsRJ9yYU1S6g50SBFzBWr5CqH+XdIWkBQFYqkZBEQefoVoMJoWfOHt5FcVfzX6DEB8PUPxofYG7KjYQAhZynPIyJZ0i6R6s8U5JB0k6XdJRkt6vw/FrnBdlcvwwyhAeFMFbU1lHA0kFKPA2SS8BbRW1KKHCKS4RYItxZxAhztFM0npJF/DdNAd7coaU8UuQk0Y/A+oMl4udm38r6UwEWAb8fCfpWDZaJOkxScvqcI5cPl9B7ImjvHwX9xZhubnEj8clXcn6Ch0MJvhOJkY1B+EXOa+JYHwJZ4j5kj7g+UhJnSQN4LgxPpvplB77JRLn7fWkBJ5kAbmHpIfZ6K6S3pb0oaTDgaFukrpIehol1uXxgbPKN4GbyyT9S9LxeOd1kmYj7B8xmEaSDpQ0HAHeAOweKOlsSY2B329QUNpmBFvgFJQnaSryekJSc/YcjJ019Y2CG64vkvSKpJnEibEIMUvST8ShiZL2kPQPPlcXwhDDAM6U9LGkZyQ1lXQGApvM31dLmiHpVEmPQMvbSbpbUm9Ji/G2H/HqvpI+k/QliogEBBzGOGYFqhtzJPWRdJGkzyX94EhLzMkkrT6xu2wgzQR6Cgp5VtL9kqYDa9OIT4MkvSjpAJR1HNbeAwuPopRFbLaG50Ml/VXSCkftK/mdxvkbSGpJflSJV6+TNAUhz0SYmY6dZWM8qyWdAGQucezM4o6n1gme74wHLyVOreX97x3jzcOzU/hePMBQf3FPCqGgNIfLL0paLukWlDMS4ZcDG40R1vHAYEtJjxK3ujmvzEJB3bH4EViueVjUCawYwS6UNA7r/jff6wcMPomC+vG7hu+XSfoTioxzHGNn6RhEldtzpXv+B9Y6QNJ+lKOW4u1VjpSEHf3f7oR3e5WUEmBHFWz0RiDlFjZ1nKSLEdpDKO1jvj8dgdwFXGa4ZFgE/mOcZYcCSXE8UAEPIYSReLUdKw0hTeXzbd3rJ0B2pgQqClVbqKpE2O/HrHEaeVkm+3sGo7M1noRBRLcXtbZXSZbZ+ww7CyEcJel6YsAPkp6CcfVzjPJ9SX9hw3l41CAEnYsSu0k6goAvB6kVzvPijgZXwsamSprkjMnYVzaveY8plXSWIyhRB6OpzhDNK1IdXOVigEZOiqHprSRdhaGOBGHs82E+v0MoeMQF2rizvhwg5CliSHpAge0gE/dJepeE8zqgqg3KLEFI3WB1R7qAPolzFOAFzdyaxknqhVfuwWeKEfAyDGYDiqvh9QjG8x1rjKLssDOAiKP/cRQ6WdKlEAlLN8xY81FkDwyxLXKw5Du6ozypxinALOthYkdvLLdI0mhIwllsfi2CfhIBdMSyCxHgPWwyKulW8pKezqLbunrgM5IGu1QgDNtbyeuzMJwKSU2IVZWO7FiA706iXe6S6Hggwa1xrZCLMLQhPL/Pean3OCM5q5GFXLzdIZ5kUGJ1sAwUsAIMlqRVks6TdKGk+by2h6SXJe2JR8QQ+O1sYC4kw4R1HpCUSt3PKh1Pw+ROARKjCKwLJGIO57tc0gPkSWuATsvxdsPrn5N0iWtlWKCPIWhjet9gdAvx1qdYb5zP1ThvshrhIGRyIqSqchvqlj/bk2wyJ4UT16DwE11lugWCbc2GhgBPn1IdsFpfBcIfShyb7RLmP0gaRT0uFUreBRq/juLnrkDJO5I+woMaSzoNK24t6Q2S0KWc80zeW4iXjXU0WY4FiuJwbyBzIfvrJukT4kxHl08dBVmSY75zMMw7QZ/wjlJSPFC8rEJpR7tcIgNBZUs6l82UkUy+iSAysFpjVftK+hseZEnmBkmH8vr1KP4NPGGapJPxKPOuQrzqBBS/mgrBNEn/A9NczBqfcDVHi7UZzkisFjkahTRACam8Ps7JoRq4H+qQxuJ0Jes/aXuUtL1wV+kwONP1fw5BKUvIIzpgicL634F6N0MRJS4wd5d0Dh64gA1mEsP24qc5lryEhPIFjllJBaEllHo1LGsWBrATcedS6ogXEyd6A02+01vpILwUtriCasdcXpvPsc4G1rMhOKPw4gR76+oS7xNIyrc5Jv2cikNmLRXmQ7GuqZRrYpLmYU3ZBPb3gJuDEFjw0Y4cJM21KrIRRncYVX+80jqvC7DQfJSb7giNZfzjoMZVePifyOtSUEqVq2bYIwelpKGgA5xx78tPIa8N4v3BDiVCjiV2ArkW/H+UhezRDWbVkiT0Sqy1M5af5Sw8l9jyBBaXwzp2Bsbeo9xixjCPDW5AmNPxREGz8xzspiPYFARV4nIfKw0dhjdkuoTcl23asuZs1+EdDK1vSXwp5Ls9JL0Fe1Qgf6vid5RznQkyJHYE3Mkt3hhRd5LUYymXvErJp0LJidP/kbQLMNjEJXkWeB8BghoFDCDE8YdiDBkwxbEOGouBt/1cVWEwSvuaOHgayrrJ1QmDRd0Ul/D6nPARcrqufK+aGHkHzC/ujCQN48hlHVl4aPH2tDK215M81GW67mgIhvYalPxHZ+VF/H0VG7mThVe7z1TDhk7DA0sc/NyAcFtRyIy6xDTkgr0F8eBa0yAXV6O0H513WWWi1LUmigPV+EU8HyPpXmJkgopCQ76b49ZV4aoL1a4ndceOYncet8MOaooRZic6o+nkPdUIPcImhzuq67ubZcDHEygr1dXeFpIUr3CEZTYV98VA5XF4WCP6TuOJb/l85yqMp7mLZ6bISsfyil2u9ALlnn4w1DCVhFmS2kMoLAZVuH1k8TwExB0daI3skH5SXkBh1nKehbVk8TwPyypx2bvNJnRQctKnmudhYoFheiqfvY+ubh5COxDFFfM7FYHlQD7O5L0fgdlnOXd/582F/C53RdyQ8767OVcHoNsqFfuRu90K/C7AUIwoZLt8chHv709r5D/WqsgOxAsFPCcDAWQ5jM1GqKPAbytQ9mHx1p62jWTyvBrBZrpYMIi4UuOqD1aXuwtPaUUWfxZlmu+VHBm7FOa1N+cdgoeuwouedZXuON61GO+3ikQEWt+KPVWTY2VJep3XDmbdX7jmZgSvLuRYWXx3KuUwm1rq4GJhxCFKuK5KKnPBLwwZSHVU+gVyjYFAzAOO/69jwwtpod/HMdKVvBrCZgGsgBnC4izgLyRmWZU9Rv7zAoZTgYfsAqMsosb3CC32biS973Oe72GNJax/J86VicAbwM5ak+8k2PMGJec2OkEU9iWX64c3d2QPmRjBoxjNdCVHzqwb3ZPXEo49xgJxtdayUXktPzF+x91rRyKMXkDaAJTzOoXRwYFaXmso919Y2CtQ6QU8n8hC7b0Sgm8Zm9oVmi7yq6NIdofxmRWcy8pT38MYWwC3C6kAnE5MutntZQVeVk5M+yeUv4xY2BRD+xMySJP0PO8/ye9xkvZRcjDyc7ypnFhZRkv/I9YfciQt08kqHpB9dlAfW2J3EVfnOhMhGYMRWN0Lt94TOtyf93ogmOcQQAmC9CPHS1istQUsTwmx+OlA0738ngEMDQUOrVo9jryqo6QJvNaHEsxahL4K6GpC9fxH9nIY1Y8MPnctVYFhxKPJvFYAvIVdCczg6kG6zUe4+lxP1/i7lUJvBdD3Gcdrhcz8bETZtsQkC6BZCOFbVxW2yvB6FJSLh+S75NCy+52UHJPy8avUtR3MUj9gsZa7HA4r2kcbp48GUqhd6JLEUxHyvnh0f7L+TgjtXcpGfZWcUmqDpzQHqu9HQRmQgdNJAfqTSryGnCpBkHT2Oscl8a0w1ErgfQZsbigGWoF3HQZz/TfvP896OjpoTN2ePCmdA4xi8RYnGiKIeUDHHbh1R0jFhcBglQuM5tpGby1IvogQLfFbgXKKgdj1vP+5pN0lXQO9boSy28DgYi64W35yAut4Hus/HgMSLYpbiFeNHQXvRX/MWt4VsMpMFFXg6nN5LkebyXFW8v1OxMkhyOd4jKkjJanOGOhKoLVKtYwpN9xCK0IcbBUW3JgFZmrjlQuNUdA1UOPvnZdEKbtYJbnSUfUMoMrKMQmgdIlr0l1ES+MwhLgeAfwTT9oPb32d1zoBcdbGPhrSci3K3QUmNhODWg1k9kVIP7j2/oV81xDFmpPGRgscK80jJCzhs92I3fvh3U8SHs4GDd7iOK8REkwma91IQHRbPCnMIl6iHDIaj1jBQqzp1xKI2t8lpwmo8RjXb8pFSMe62GZM5wg29TZwsBwlNSRhXEaZaSHlnRuB0uXA01iIyIOcp5pzNMXA5kBYlsHIViKUtSjyKrz0NVcaKnOpiHl4KTJIdyUgG0uO83xPoNSXllrD+i5HVj8RFwtZ2w0k+FM5brQuSrJyyHwEdx74fT0Wa4XHh4gdXZUc9y2j/HG+y7j9JFDE9fqteZjOWpoCTzbwOIZN/xEh7gHr+jPHXQIc3q6NI8bFePZMztkWAnEO5KIZ3nMQx9mTc7+G9/TCC592JZ0eGFaOU6ClD2UuP7QLrSdgoKkutn+NHG/EWLoSTwexjg58948OibYKdzFtnHfrhBW8gBWfq+TM3S1seDhWmeaGLfo7nE64ykS6q0yUcSzr5DZhHqIaC38cZQzA8joyMPIahCKCZ8zEAgcCvxG8rYjEtw0QNY/1DSL/iSD4Bwn2szDAW+i6TmYNz+LlRS5eRAMMOBqoend0E1U1vDYfBXVmLf1Zd3PSlKWwQl/52GIV/EI03Jjs3aoPJTCbNhQ7p3DQQlcxeBfFVjtWZ/ie4irBNuDYnfcXAaOzoMnPIcBTwPI1kIbeeG9fEuebUO5QvCaGF1diocfgUT3woIeo663hR8Sr753XlBHvDma9J+IhlujnOyXZHkMgx8Mow3pRGZCgLq7QLOJtPvngLRjCTa6P9n83DNkc3M11JRixeZsfa0772jxLrtUQ4bXhHDcDK1rCya0RVuNgz8aKc12u1B8hPQcrWkawn4sRfEEMWs7md3ZGZFBazbnWOVg7maT2RQzhCdbXFFo8CSbYAjIxnWPOxTufcwVYq+NFXYHVrpt6CWjLcqWqG1nHJa6qHnZtmGNAjMV4r6UniS0RB4tLfsauLzDwCQHY2E8WingeSy9ybXNhWR1dznQWsaOIMk5TF0fy2LRB3P6wv0YIZAivr+T8PwAfdyH42xFMS+jvaM57HWyrMQ3JB8mhBmDVPVnTARjaLtp4RYjw4MeApA5OgAZlKY4wlUIK2uNVXWCU55MkX8R5c1zvyryuB7L9uq5KMkXlkmjO52Rf0ia34qtVt+ezQbvMMRWLi7iKwxWwthQEXYN15gGhs50H7ouwjiRGDWSDj3GOZWyoAq9phaI/4fflGNnNQOEk6PpyJSddR3DcHIxgGATJzj9XyVnxVPZ4OK/nuWKshQGbVU8HCaqB6jNAnxhrOQOiYhdnl7pyUZqL04mtKSnYubwULH9dyWtHy9lgNZt7xlHIVE7mPepTqOjEQJKbDpsrxRBy8LYRQMQDxAK7LDIL6roc+N2A0gci4OuIbZeyjwf4uy1r+5LjvA6Ty3Ax+m289CQgfxJ0f6wrbfWEKf7kemMlgWmjQojHZ8S+zqDQcFjk28Siam16YZwCTcytUnAbVzoeYUxQ8nL7qGts7QVFnuOSsholr7KzqR27GOsWPMFf5JwJdL3t+jmrgaPefHYNyjodq8/Gy2zO7iTShasQ/uOu+hzneRowNJoxr7V4Xg4J7QDo+skI9FasvhxkSHNWfg7QNTfQvKxhD1aBn4pHzeM4/YDYxtp46Wi5M9hEoLO81WQ2jmXsCf1dxSJCboonk3jwKTS6wI1JRZQcgi8PMKF3IAiVjoKPR6CWO+1Ntj4ZmhpD8R2dQSxwhdseVBiaOqqb6/YxB/Zm93SYQJxZxzq+IN0YgKffSU7Tx4172SOfMNAPg8l3JSMb41oCo9zFMTbLDW19TTi/aplW2uogSsSVQcaA7TUukbVy+6lKXknxlittWO9oKpDT1im4lIB6MgVOUXs73Q1wLAIy4mB4KueeSSG0GBjrg9L2BqYGkt8NQxGv8r1lxJcS8qKbMLpvMY6zIR1hF4Puc0OOMdY1BLhczHq/x+vzlbxIwF+UvRajkeuXZSLDKUDuBM5bolrux7el9nm8Fve1RNYGLc4gp1rqRrCWOAUVAx1XYCEpWE82xzyEPCidJLOY2PYB7KwaejqJ463SxpHdkxF6EyBnLpA8ndhxDzT4DBLihVDc1RhftRslewfvfQh5WIqQ5grC5nnPE0/+Sjy6m1jaw5GIPEfNj0LRy/DKIjcaUAm5qSLPK9GmN1Ssk5LaYh0vgp9rtOnorV17tBvU9TQ3s2ad3WwW8xZub0lxjEUVOFZUDFG4FgttgTKuRIHWjn4Gay6FKX2N11gpx8pTn3Bc6yF1Z02zMQ7L6idTgX6DktBMV5e04f0M2GcL/i5yaFPGWkJOUTGY7sew01Q81+K9tecr6S6c44wita5w1w+Lf5jcqAkJ1lJgaQTx7M8o4CHnfVGsycaMr+TErfCCGN5WAETNc3Hxa1frymbTl3HeV8jN1uERqQgrh3XmQjr6ovCRCOFD3ltPPHgbeHmONb6HJ5yOp1zsiFPYlXy+QLBTiWtWdM1mHSFnlOmQFOv63sM5/8baYq5CsQAD8rcorZMnTXW0eyCb2ZPXFsO2SokB32IFC1yOEOakcZQaZ6HG9grItUa4/r8NFXZhYz3B8mlOKeVuNuFmNnUpVj4Rby5083yH0Db4B+dMAQYvpcJwMee8jfTiXlog1W58y+YPTnIGHHYjBlWQgHRX5QiRT73Ied7CuMa7ynoKHnQd79kUb1pdlRSGOUWAgH+z2Vm8N47ELgNhpbieyzwspDufPQ7F3OumijqRkZ/uMDgTgYylzLMOyDgISn0NsaA9a2qLodxL6SgfllmAsKbgYatZ+17AZj/eX4N3PUipaRgGs8BV7Ksdk7Mr2F9xZbAPmV69wJW+/JWPNcSkLIw7puRFBbNBjFIX67e5nxTMl86Anhq/t1peJ14Pu8Bpg4+toZ+zSTgzKI/M0KYjykZnQ8DjaCzxErxtg5JXCr4MvNxGPCzC435ASQ0J2O8COf+iBVCEcSXIf9bD6BIo8iuIyXsBKmw1wS5ApRnVCOJMOmxvZxTcl89YaWcar2Wx9n1ox3RneOdJmPGGQAmuTsQhN5DQjkdIr6OgbDdPl+HyJj9+3BtL25fjpTujiLvS0gcO8u7BOB4lRuyGFaYyonU8RKA/SsjXppeHVrgGYFe8YSJrLIRRXY2F93QDIncTo83YcgOVhHdIwo0gDHVGfC6eYPnkMFcu+s6hUwPXd/oKQ/oJBWVrM3PiDbcy1yA3KyB3ArsTyCBYldFHf73owVjuUXif3XfhJSwrE+Vk1NK2f5Syy7VY3Shg7Qpg+H2oe3vIS7rLZfKJoU2w/t2dJ8URdlNocRtYXU+MsIj1pGrT++HZqPNDwFXctcyjpAi7A6n3U2C1AdJzkUsFk7XHYDyXEQoecYMotV0KtFm4C7lcJxwgBGWutteXomck0G62gYt8NrMWK7Uh9kqC+go+f6wjEBabdsUKc7HQjtp4eeZulKiOdrD1LgzwLBRyHArIwutnUrZaj+L+jpLKON6/XMoxUcmB/TRtesV4DkRoCBWQ+RhGR753KrHT30h+PXHVD5hkYOCTXPJrCs93yLLF4Ui7N1xoC8OTMyASRWBxEURgOMooV/JCXrslzFg8q4yFXOA+a9S9wM21lSH8KnKmUko7a6DE8/GmpZznFOKYlYhSEVqCfOgtBLQTwr4dJtnG7a3CrSnM7654iY1ozcKIOrjP2qzDStZtQ54HOMOLuBys3IWJclewLt+W4Ug5GLEeyicstpgmWAGLHAqZeI/FlLsqulnG1VhmhIBtA5HDiDltSSq7wuyO5HNDOMZPeNYIKO+1CGEyVvwBChtCLCtEAAtRTmegcRTkpQnrHchnMlj7acSnbvz9Me0Ru6hgMgqa5FoMlhasxwgnkOjbbOGpoMWfUZrJ5E7CQjnHvCvQedgi3BnLCN6wqAsnt4mZ06mNNQpUbkOuXZ5wcNmBnGUVx7Cr9KIBl69mbfsoeWeVOVDXc1HiZ8DPZAL6sUDvV3juoQhgIAIPu3j3Osp8GWMr5vuf4l1yI17W6l6l5JXuUScba9iNJ78cBKNbQgowl4JtmFrjPezvYZDkCgx9AMY1NVgF31zFocYJ23A5E5ppY8YTsfbvsP55ju0ZQ/LVcpsPOMANfJwMVNkAez4JpiWXR/KdVqzjY+LRYJijOEZ7ekuNmL1+lfytOVS3mDXlIJgQNL8NSHEz1YDVCLEZx4pAFBa6/CfF1fdyUdBJ7OcMjjmWONSVvX9D4hp21H4GYeJxhx5fBBVUl1aFMbUwm2/FhrOBjZvdPFqWNr2rb9hVexXoHaUivOm0x2ewsTg51SfOWiNs4jXOs8F5aglM705HQgYioCMwhi+JTx/hLf3wyk8wtDFAXy4CnkrJaEmgY2r3NJqj5Ly69czisLbunKu3kjd9Envrx1qH0fM6DW9+lM9cDyy22xYl5bhF5gMrDZW8F7f1RKoDjCQ4JuuPI9c0M0uMuqHKbODvFW16V64UipvTgcD1vPcgiXQ1FlnA6wOBk/uAqukIIEIsuVXJK+6Gkyq8z1p3dfW1DNdhznHGWB5gwfZoAxONsc5xyLiX61N1dLMQNhi5hD2M3hYKLkcVbWbOLgV5EfeeR0C1W6KdiRXGamm/2waN2tZW2fgBzLZrfZ4ka7eL1RYQhzqzyeawu3ls8jqM536s8lmg0BLcSgJzeyAt4bx1Lseya2sLQY1HHAqkuDBgN9AwYyxQ8k6T3YgtDfCsBLnkLuzNlHQ9udJjoM+NSl71XiclpbqOqo3c3gY0zMOqpxKA3wgcw08Z2fht8HYCpqxMLG4nYtVeCNsej3CuPs6j7G6OcTbfDIjsDKTEiDvtlbySIh0IehkB2xXxXYk5YzCiAeRTX8Is21Gfm6XkzXT9vSv8vqzAOoRzj6fX9g1k5CtITyP2eJCrRqSwlsJtqTikuHaxJakbKMUU8lo/vm9QlYtLrwlYnREGf1+8YpLZp4gTz5FcvuxylXlK3pRjsGs8Vih5b+9hCP9hKPp8nl8DzG0guc2CbhegDLuo+X6EKl5fx3dexIsPd5X0NNeBzXL7ynUF1Rw3D3gJRKcdSplOTrY7yfR37MFieaHz0jopyW5S7qdWblXy1jRWNnmYAD0DAtCOZK4XgTTummZ2U/QMvO9NAvYbxIFlCMkai11dxcNuh7PItfXzHVPKg243ceNdf0W4jR2hmaXknSAfAGLz2ec0FDWczx0LRP2Tc7RW8i5iNiVlcsh0db5K4t6J7G0CRma3hHucqn1BIKe01Kd0e2KSn33+B1ZSDrOrZIE2iWrxohHx4yUSXWN2H5HrfIhVtoSV/UhF+UhXGF2g5IVnaWzS6m++bNWB9Uzl+RzYk5WmPDqYAdTgKU1YdyWyaEywn0u+czVsrSeQex9rXYZneJIUdkhhROMN2jx9UdZlrkGYqIV42BX7i+riSbmucRcNzN6tgQ7/BQVZcbWja/Q9AQOzEapcPGtvSMfj5A0bICP9sNjL8MYvaQucC3wdgcCyA4QmBaVUccyf6Mhe5WJYlouPVujcDU/uTe53MUq4Fxa7VBuv4JiAp/UHur6FfPwdaI8qeYcWq6BYzLoIGRhLPdg1BXMdQvV0Ck7UVnHYXO2u3NWkyl0l3Gp6N4HHV3FQm+y5Fuga5I7xA/S3hZJX7y3EmoegjHlUM+xyzp8gEXZ3x3KKtDcE6l7l4P0VBHyrfx2Dxb/pXqt0tcSGrrVR7qzd5t/mgwatQYy1eNSBGNkZpAlt3ASQ1ebKKfj2x6gXuVhr6yh3s3vB/SSCutjSSFcioEjvUROxiPf5uR0ou99h6mfA4xTeL2bzh+FFoyAMX9A6sCH1C/COZa60ZB3N2W4NC4C1vZS8sHkPKuEvs5YYlrrStd9n099a4gYRW1Gva4Cg24EYf8CD82huGrxOwbA+IBXYyx0zgjHGodkPwYwtJfE3PlRgP7W9/rPu0mUJrN322f6P0mlY9j0opAihFwEBbwORhxKs7YqHXIJpFzyhn4sz3bD+GDhvXnAO0NUAI3oA755CzNkfwTRwqcUzeMIlrMkqAzV4expwZ/HmadazL4qyKdcWxNPRUO2P2UsvJS9wM2SIuUHRFG3jzXK397Y1/p9HNaTudQF9HBvHKoUi3wFMHUOsepSfb6kYG6QVAQVmSXNc2365C8T2L4GiGIJQxl3AS2cKpXbF+VAgyYTTh8bfpygq09H7iGOgCY51Lvs5D0+9GM/pTe4zBMVMI66eSo50sqvZWSc6oe24m/HP8aQsl6h+zoLKXMc1AUu6EsGsw8KWIyCf1PZA8AuAiHI2Oh7PHIHCjQ0F/2PzGKx5FOtYTNDfXclb5STw/hLWnkEO9QUxJw8EONhV7auA0UV8/0qS3CV4fB/g/nIlb5PdFaXPwsv7KHnjxFAtoeQXU5JdQ1TjWNZ62JrNo80jPhziej9vuaSttv/b0AEPbImg5mG1vsjp/21biivPNAfurFLyOcLzw55Lauk+f4mXH0ul4HIlb0a1KECTzaj2Jw9aicHcpOTFCyns8343RCkXErb5P5X9HE+Sy2PsRhy3EyQHE4gHQrsbQ9nts7693MFZqt2xaz74PwuIuQNoHFhL+SkHr8rCumeSa9kNbW1MKuaq6vkk4LOh0iOpADRT8n4//v/YZrgZCq/k9qDFXCXvhf4QtN4bR9hR63Rt+m8WfjEl2S3PilwNK+YqAOchoAedBdrAoq+K+yKseUoIAtGLdngaSWlUyavM7Y5XWVDlON/JIQ7dCgMdAkUvAVJHAkkjiTXrXflrNwyjOjBaFXLKtfXluOq9FVg7Uk6yBL844L02/169I2OSBdhqlyPUBCrn3mp8i8K7f47rDVkTLUwntCHfOUXJ+x/YJS/5CNtaGEcTm2qA2dXEqB+VvLFgCxLWfYgd44h5s2CEj7t92Np95d4QwJhtlpL38gv+Q0l/d01/jG3+9zw/F+5+qUcqMeZTyEgzYoXV+w5BKCdSn5tKze1rGN94YtIfCfZDKeaeT9ycjbL3xOvtDsreeOrNo74qyaZ9emHplgSfDfvbn9fH83kv5BRg7i68pxGxowE50pXaeE1REV46j9KU5Wv1Th71VUkGOcPJv4ZQkSimVPM05ZoVrN+uFu8NdD7L869hb0dDs3elGnEK9LwFLGy5NnNFQ314NFL9fNQEcNz+e0x3KPwVlGxmI9xTtHFcaldqatehoO+Ijc0p76ygrjiWuLUrCjIP3K6Y8d/qSf420XlAkrHBthAG61MNcY3ETGDyPiWHQozp3UWAv0fJ/5wmV2Ky+wP9Iv+G9LeoJAVosK+BBVsqFdDh7tq0/RzMR+wGv5Xa9H8D5mkzbev68mhYj9cW16ZXSoSU/Dc4Pou37L2Q4mfIKSHTFYPjrt9lg58VTkG59VUQ9dWTfM7hu8M+XnhPsbkAux9dKFCC8bTa/3tUu79PSiB5/R3ufn/8duDu98fvSvr1PP4XGa03R+VtDmoAAAAASUVORK5CYII="} alt="Royal Coat of Arms of the United Kingdom" style={{ display: "block", width: "100%", maxWidth: "clamp(65px, 8.5vw, 130px)", maxHeight: "78%", objectFit: "contain" }} /></div>
      <div style={{ borderLeft: "2px solid #17243a", paddingLeft: "6%", minWidth: 0 }}>
        <div style={{ fontSize: "clamp(20px, 2.9vw, 44px)", lineHeight: 1.02, fontWeight: 800, color: "#050a12" }}>Funded by<br/>UK Government</div>
        <div style={{ marginTop: "3%", fontSize: "clamp(9px, 1.35vw, 21px)", lineHeight: 1.2, color: "#17243a" }}>This product is supported by the<br/><strong>Warm Homes Loan Scheme.</strong></div>
      </div>
    </div>
    <div style={{ ...absolute("3.6%", "74%", "53%", "19%"), fontSize: "clamp(10px, 1.5vw, 23px)", lineHeight: 1.32, color: pale }}>
      The Warm Homes Loan Scheme helps eligible homeowners and private landlords access more affordable finance for eligible home energy improvements, including solar panels and battery storage.
    </div>
    <div style={{ ...absolute("58.4%", "12%", "38.5%", "82%"), border: "2px solid "+cyan, borderRadius: 20, padding: "2.1% 2.2%", display: "flex", flexDirection: "column", background: "rgba(0,19,35,.58)", boxShadow: "0 5px 24px rgba(0,0,0,.16)" }}>
      <div style={{ textAlign: "center", fontSize: "clamp(8px, 1.12vw, 18px)", letterSpacing: ".22em", whiteSpace: "nowrap" }}>V12 – REPRESENTATIVE EXAMPLE</div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "2%", marginTop: "2%" }}>
        <span style={{ color: cyan, fontSize: "clamp(58px, 9.7vw, 155px)", lineHeight: .9, fontWeight: 900, letterSpacing: "-.07em" }}>3.6%</span>
        <span style={{ color: cyan, fontSize: "clamp(21px, 3.4vw, 54px)", fontWeight: 800 }}>APR</span>
      </div>
      <div style={{ textAlign: "right", fontSize: "clamp(10px, 1.8vw, 28px)", lineHeight: 1.1, marginTop: "-.5%" }}>Representative</div>
      <div style={{ fontSize: "clamp(9px, 1.55vw, 25px)", lineHeight: 1.2, margin: "1.7% 0 2.2%", color: pale }}>10 year finance (120 months) through <strong>V12.</strong></div>
      <div style={{ flex: "1 1 auto", minHeight: 0, border: "1px solid rgba(8,199,237,.6)", borderRadius: 13, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: "0 0 12%", minHeight: 20, display: "flex", alignItems: "center", justifyContent: "center", background: cyan, color: "#001629", fontSize: "clamp(9px, 1.3vw, 21px)", fontWeight: 900, letterSpacing: ".12em" }}>REPRESENTATIVE EXAMPLE</div>
        {rows.map(([label, value], index) => <div key={label} style={{ flex: "1 1 0", minHeight: 0, display: "grid", gridTemplateColumns: "57% 43%", alignItems: "center", borderTop: "1px solid rgba(8,199,237,.45)", padding: "0 3.5%", gap: "2%", fontSize: "clamp(8px, 1.35vw, 21px)", lineHeight: 1.12 }}>
          <span style={{ color: pale }}>{label}</span><strong style={{ color: cyan, whiteSpace: "nowrap" }}>{value}</strong>
        </div>)}
      </div>
      <div style={{ marginTop: "5%", fontSize: "clamp(6px, .78vw, 12px)", lineHeight: 1.35, color: pale }}>Finance subject to status, affordability and scheme eligibility. The Government supports the interest rate but does not provide the loan. Finance is provided by V12, a trading name of Secure Trust Bank PLC. Homeshield Scotland Limited is a credit broker, not a lender. Authorised and regulated by the Financial Conduct Authority, FRN 624069.</div>
    </div>
  </div>
}


export default function DatabaseSalesPresenter({ appointment, onClose }) {
  const [sourceUrl, setSourceUrl] = useState("")
  const [pageUrl, setPageUrl] = useState("")
  const [renderedPage, setRenderedPage] = useState(null)
  const [viewerSize, setViewerSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const pdfContainerRef = React.useRef(null)
  const [page, setPage] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [pdfBytes, setPdfBytes] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [renderingPage, setRenderingPage] = useState(false)
  const [sessionUser, setSessionUser] = useState(null)
  const [closeLogged, setCloseLogged] = useState(false)

  async function logPresenterAction(action, details = {}) {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const user = userData?.user
      const now = new Date().toISOString()
      const { error } = await supabase.from("action_runs").insert({
        action_type: "sales_presenter",
        status: "completed",
        entity_type: "appointment",
        entity_id: appointment?.appointment_row_id || null,
        triggered_by: user?.email || user?.id || "unknown",
        started_at: now,
        completed_at: now,
        input_data: { event: action, appointment_row_id: appointment?.appointment_row_id || null, customer_name: appointment?.name || null, ...details },
        output_data: { event: action, logged_at: now, ...details },
      })
      if (error) throw error
    } catch (err) {
      console.error("Sales Presenter usage logging failed:", err)
    }
  }

  function changePage(nextPage, source = "button") {
    setPage(current => {
      const target = Math.max(0, Math.min(Math.max(0, pageCount - 1), typeof nextPage === "function" ? nextPage(current) : nextPage))
      if (target !== current) logPresenterAction("page_changed", { from_page: current + 1, to_page: target + 1, navigation: source })
      return target
    })
  }

  function closePresenter() {
    if (!closeLogged) {
      setCloseLogged(true)
      logPresenterAction("closed", { final_page: page + 1, page_count: pageCount })
    }
    onClose?.()
  }

  useEffect(() => {
    let cancelled = false
    async function loadPresenter() {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        const token = sessionData?.session?.access_token
        if (!token) throw new Error("Please sign in to the CRM to open the Sales Presenter.")
        const response = await fetch("/api/sales/open-presenter-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ path: PRESENTER_PATH }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result.url) throw new Error(result.error || "Unable to load the Solar Presenter PDF.")
        const pdfResponse = await fetch(result.url)
        if (!pdfResponse.ok) throw new Error("The presenter PDF could not be downloaded.")
        const bytes = await pdfResponse.arrayBuffer()
        const document = await PDFDocument.load(bytes)
        if (cancelled) return
        setSourceUrl(result.url)
        setPdfBytes(bytes)
        setPageCount(document.getPageCount())
        logPresenterAction("opened", { page_count: document.getPageCount(), presenter: "solar_pdf" })
      } catch (e) {
        if (!cancelled) setError(e?.message || "Unable to load the Solar Presenter PDF.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadPresenter()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!pdfBytes || !pageCount) return
    let cancelled = false
    let renderTask
    async function renderPage() {
      setRenderingPage(true)
      try {
        const pdfjsUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
        const pdfjs = await import(/* @vite-ignore */ pdfjsUrl)
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs"
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes).slice() }).promise
        const pdfPage = await pdf.getPage(page + 1)
        const base = pdfPage.getViewport({ scale: 1 })
        // Size the PDF from the actual centre column, not the browser viewport.
        // This keeps the rendered page aligned with the space between the nav buttons.
        const availableWidth = Math.max(1, containerSize.width - 152)
        const availableHeight = Math.max(1, containerSize.height - 16)
        const scale = Math.min(availableWidth / base.width, availableHeight / base.height)
        const viewport = pdfPage.getViewport({ scale })
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d", { alpha: false })
        const ratio = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        context.setTransform(ratio, 0, 0, ratio, 0, 0)
        renderTask = pdfPage.render({ canvasContext: context, viewport })
        await renderTask.promise
        if (!cancelled) setRenderedPage({ canvas, width: viewport.width, height: viewport.height })
      } catch (e) {
        if (!cancelled) setError("Unable to render this slide. Please refresh and try again.")
        console.error("Presenter canvas rendering failed:", e)
      } finally {
        if (!cancelled) setRenderingPage(false)
      }
    }
    renderPage()
    return () => { cancelled = true; try { renderTask?.cancel() } catch {} }
  }, [pdfBytes, page, pageCount, viewerSize, containerSize])

  useEffect(() => {
    const body = document.body
    const html = document.documentElement
    const previousBody = { overflow: body.style.overflow, width: body.style.width, height: body.style.height, margin: body.style.margin }
    const previousHtml = { overflow: html.style.overflow, width: html.style.width, height: html.style.height }
    body.style.overflow = "hidden"
    body.style.width = "100%"
    body.style.height = "100%"
    body.style.margin = "0"
    html.style.overflow = "hidden"
    html.style.width = "100%"
    html.style.height = "100%"
    return () => {
      body.style.overflow = previousBody.overflow
      body.style.width = previousBody.width
      body.style.height = previousBody.height
      body.style.margin = previousBody.margin
      html.style.overflow = previousHtml.overflow
      html.style.width = previousHtml.width
      html.style.height = previousHtml.height
    }
  }, [])

  useEffect(() => {
    const element = pdfContainerRef.current
    if (!element) return
    const measure = () => {
      const rect = element.getBoundingClientRect()
      setContainerSize(previous => previous.width === rect.width && previous.height === rect.height
        ? previous
        : { width: rect.width, height: rect.height })
    }
    measure()
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure)
      observer.observe(element)
      return () => observer.disconnect()
    }
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [loading, error])

  useEffect(() => {
    const resize = () => setViewerSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  useEffect(() => {
    const onKey = event => {
      if (event.key === "Escape") onClose?.()
      if (event.key === "ArrowLeft") setPage(current => Math.max(0, current - 1))
      if (event.key === "ArrowRight") setPage(current => Math.min(Math.max(0, pageCount - 1), current + 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, pageCount, page])

  useEffect(() => () => { if (pageUrl) URL.revokeObjectURL(pageUrl) }, [pageUrl])

  async function enterFullscreen() {
    try {
      const element = document.getElementById("solar-sales-presenter-viewer")
      if (element?.requestFullscreen) { await element.requestFullscreen(); logPresenterAction("fullscreen_entered", { page: page + 1 }) }
    } catch {}
  }

  if (typeof document === "undefined") return null
  return createPortal(
    <div id="solar-sales-presenter-viewer" role="dialog" aria-modal="true" aria-label="Sales Presenter" style={{ position:"fixed", inset:0, zIndex:10000, background:"#07111c", display:"flex", flexDirection:"column", boxSizing:"border-box", color:"#fff" }}>
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"10px 18px", background:"#0c1a29", borderBottom:"1px solid #23384a" }}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:12,opacity:.72,marginTop:3}}>{appointment?.name ? `Presenting to ${appointment.name}` : "Homeshield Solar Presenter"}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {pageCount > 0 && <span style={{fontSize:13,fontWeight:700,minWidth:64,textAlign:"center"}}>{page + 1} / {pageCount}</span>}
          <button type="button" onClick={enterFullscreen} title="Full screen" style={controlStyle}><Maximize2 size={17}/><span className="presenter-control-label">Full screen</span></button>
          <button type="button" onClick={closePresenter} title="Close Sales Presenter" style={controlStyle}><X size={18}/><span className="presenter-control-label">Close</span></button>
        </div>
      </header>
      <main style={{flex:1,minHeight:0,width:"100%",minWidth:0,marginLeft:0,marginRight:0,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",padding:0,boxSizing:"border-box",overflow:"hidden"}}>
        {loading ? <div style={{display:"flex",alignItems:"center",gap:10,color:"#fff"}}><LoaderCircle size={22}/>Loading presenter…</div> : error ? <div style={{maxWidth:520,padding:24,textAlign:"center"}}><div style={{fontWeight:700,marginBottom:8}}>Presenter unavailable</div><div style={{fontSize:13,lineHeight:1.6,color:"#d4dbe4"}}>{error}</div></div> : <>
          <div style={{position:"absolute",left:20,top:0,bottom:0,width:48,display:"flex",justifyContent:"center",alignItems:"center",zIndex:2}}><button type="button" aria-label="Previous page" disabled={page===0||renderingPage} onClick={()=>changePage(p=>p-1,"button")} style={{...navStyle,position:"relative",top:"auto",left:"auto",transform:"none",opacity:page===0?.35:1}}><ChevronLeft size={30}/></button></div>
          <div ref={pdfContainerRef} style={{display:"flex",alignItems:"center",justifyContent:"center",minWidth:0,minHeight:0,width:"100%",height:"100%",padding:"0 76px",boxSizing:"border-box",overflow:"hidden"}}>
            {page === 28 ? <TandemFinanceSlide /> : renderingPage ? <LoaderCircle size={26}/> : renderedPage ? <canvas ref={node => { if (node && renderedPage.canvas && node !== renderedPage.canvas) { node.width = renderedPage.canvas.width; node.height = renderedPage.canvas.height; node.style.width = renderedPage.width + "px"; node.style.height = renderedPage.height + "px"; node.getContext("2d").drawImage(renderedPage.canvas,0,0) } }} style={{display:"block",maxWidth:"100%",maxHeight:"100%",objectFit:"contain",boxShadow:"0 4px 18px rgba(0,0,0,.35)"}} /> : null}
          </div>
          <div style={{position:"absolute",right:20,top:0,bottom:0,width:48,display:"flex",justifyContent:"center",alignItems:"center",zIndex:2}}><button type="button" aria-label="Next page" disabled={page>=pageCount-1||renderingPage} onClick={()=>changePage(p=>p+1,"button")} style={{...navStyle,position:"relative",top:"auto",right:"auto",transform:"none",opacity:page>=pageCount-1?.35:1}}><ChevronRight size={30}/></button></div>
        </>}
      </main>
      <footer style={{display:"flex",alignItems:"center",justifyContent:"center",gap:18,padding:"12px 16px",background:"#0c1a29",borderTop:"1px solid #23384a"}}>
        <button type="button" disabled={page===0||loading} onClick={()=>changePage(p=>p-1,"button")} style={bottomButtonStyle} ><ChevronLeft size={17}/>Previous</button>
        <span style={{fontSize:12,color:"#a8b8c8"}}>Use the arrow keys or buttons to navigate</span>
        <button type="button" disabled={!pageCount||page>=pageCount-1||loading} onClick={()=>changePage(p=>p+1,"button")} style={bottomButtonStyle}>Next<ChevronRight size={17}/></button>
      </footer>
      <style>{`@media(max-width:600px){.presenter-control-label{display:none}} #solar-sales-presenter-viewer:fullscreen{background:#07111c}`}</style>
    </div>,
    document.body
  )
}

const controlStyle={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,padding:"9px 11px",border:"1px solid #334b60",borderRadius:8,color:"#fff",background:"#13263a",cursor:"pointer",fontSize:12}
const navStyle={position:"absolute",top:"50%",transform:"translateY(-50%)",zIndex:2,width:48,height:64,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #38536a",borderRadius:10,color:"#fff",background:"rgba(12,26,41,.88)",cursor:"pointer"}
const bottomButtonStyle={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,minWidth:104,padding:"9px 14px",border:"1px solid #38536a",borderRadius:8,color:"#fff",background:"#13263a",cursor:"pointer",fontSize:13}
